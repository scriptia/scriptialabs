import { NextResponse, type NextRequest } from 'next/server';
import { eq, sql } from 'drizzle-orm';

import { requireBearerToken } from '@/server/auth/api-token';
import { db } from '@/server/db/client';
import { appDeployments, pipelineRunEvents } from '@/server/db/schema';
import { requireLease } from '@/server/pipeline/lease';
import { deploymentReportSchema } from '@/server/validation/pipeline-runs';
import { sealSecret } from '@/server/vault/crypto';

export const runtime = 'nodejs';

/**
 * The build's backend and release stages report where the app now lives: the
 * Supabase project they provisioned, the EAS account/projectId they linked, the
 * version they bumped to, the build they started.
 *
 * `expectedAppVersion` makes the version bump optimistic: the write only lands
 * if the stored version is still the one the stage read. Two releases of one
 * app can never both bump 1.0.1 → 1.0.2 and ship the same version twice — the
 * second gets a 409 and re-reads.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireBearerToken(request, 'PIPELINE_RUNNER_TOKEN');
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Body is not valid JSON.' }, { status: 400 });
  }

  const parsed = deploymentReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Payload failed validation.', issues: parsed.error.issues }, { status: 422 });
  }

  const lease = await requireLease(id, { runnerId: parsed.data.runnerId, leaseToken: parsed.data.leaseToken });
  if (!lease.ok) return lease.response;

  const betId = lease.run.betId;
  if (!betId) return NextResponse.json({ ok: false, error: 'This run has no bet.' }, { status: 422 });

  const { expectedAppVersion, revenuecatWebhookSecret } = parsed.data;
  // Only the keys the stage actually sent: an absent key leaves the stored
  // value alone, an explicit null clears it. Identity fields are not columns.
  const set: Record<string, unknown> = Object.fromEntries(
    Object.entries(parsed.data).filter(
      ([key, value]) => value !== undefined && !['runnerId', 'leaseToken', 'expectedAppVersion', 'revenuecatWebhookSecret'].includes(key)
    )
  );
  if (revenuecatWebhookSecret !== undefined) {
    set.revenuecatWebhookSecretEncrypted = revenuecatWebhookSecret === null ? null : sealSecret(revenuecatWebhookSecret);
  }

  const rows = await db
    .insert(appDeployments)
    .values({ betId, ...set, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: appDeployments.betId,
      set: { ...set, updatedAt: new Date() },
      ...(expectedAppVersion !== undefined ? { setWhere: sql`${appDeployments.appVersion} is not distinct from ${expectedAppVersion}` } : {})
    })
    .returning();

  if (rows.length === 0) {
    const [current] = await db.select({ appVersion: appDeployments.appVersion }).from(appDeployments).where(eq(appDeployments.betId, betId)).limit(1);
    return NextResponse.json(
      { ok: false, error: `The app version moved to ${current?.appVersion ?? 'unknown'} while this stage worked; re-read and bump again.`, appVersion: current?.appVersion ?? null },
      { status: 409 }
    );
  }

  const changed = Object.keys(set).map((key) => (key === 'revenuecatWebhookSecretEncrypted' ? 'revenuecatWebhookSecret' : key));
  if (changed.length) {
    await db.insert(pipelineRunEvents).values({
      runId: id,
      level: 'info',
      stage: 'deployment',
      message: `Deployment updated: ${changed.join(', ')}.`,
      data: { appVersion: rows[0].appVersion, easOwner: rows[0].easOwner, supabaseProjectRef: rows[0].supabaseProjectRef }
    });
  }

  // The sealed secret never leaves the panel in a response.
  const { revenuecatWebhookSecretEncrypted: sealed, ...deployment } = rows[0];
  return NextResponse.json({ ok: true, deployment: { ...deployment, revenuecatWebhookSecretSet: Boolean(sealed) } });
}
