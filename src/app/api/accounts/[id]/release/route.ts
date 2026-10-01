import { NextResponse, type NextRequest } from 'next/server';

import { requireBearerToken } from '@/server/auth/api-token';
import { db } from '@/server/db/client';
import { pipelineRunEvents } from '@/server/db/schema';
import { releaseAccount } from '@/server/pipeline/queue';
import { accountReleaseRequestSchema } from '@/server/validation/pipeline-runs';

export const runtime = 'nodejs';

/**
 * Lets go of a platform-stage account before the run ends — and, when it ran
 * out (EAS reported the monthly build quota), marks it limited until its cycle
 * resets so no other run tries it. Quota numbers merge into the account's
 * `quota` for the Accounts page.
 *
 * The Claude session account is NOT released here: it belongs to the claim and
 * is released by pause/complete.
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

  const parsed = accountReleaseRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Payload failed validation.', issues: parsed.error.issues }, { status: 422 });
  }

  const { runId, limitedUntilEpoch, reason, quota } = parsed.data;
  const limitedUntil = limitedUntilEpoch ? new Date(limitedUntilEpoch * 1000) : null;

  const released = await releaseAccount({
    accountId: id,
    runId,
    holder: { runnerId: parsed.data.runnerId, leaseToken: parsed.data.leaseToken },
    limitedUntil,
    reason,
    quota
  });

  if (!released) return NextResponse.json({ ok: false, error: 'No such lease held under this token.' }, { status: 409 });

  if (limitedUntil) {
    await db.insert(pipelineRunEvents).values({
      runId,
      level: 'warn',
      message: `Account limited until ${limitedUntil.toISOString()}: ${reason ?? 'limit reached'}.`,
      data: { accountId: id }
    });
  }

  return NextResponse.json({ ok: true });
}
