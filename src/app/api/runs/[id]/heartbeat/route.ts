import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';

import { requireBearerToken } from '@/server/auth/api-token';
import { db } from '@/server/db/client';
import { pipelineRuns } from '@/server/db/schema';
import { requireLease } from '@/server/pipeline/lease';
import { heartbeatRequestSchema } from '@/server/validation/pipeline-runs';

export const runtime = 'nodejs';

const DEFAULT_LEASE_SECONDS = 900;

// Extends the lease and reports progress. Called every ~60s while a run works.
//
// It is also the CANCEL channel: the response carries `cancelRequested`, and a
// runner that sees it touches its STOP file so product-agent halts at the next
// stage boundary. Cancellation is a reply to a poll rather than a signal because
// there is nothing to signal — the runner is on a laptop behind NAT, and killing
// it mid-stage would leave half-written artifacts.
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

  const parsed = heartbeatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Payload failed validation.', issues: parsed.error.issues }, { status: 422 });
  }

  const lease = await requireLease(id, parsed.data.runnerId);
  if (!lease.ok) return lease.response;

  const now = new Date();
  const leaseSeconds = parsed.data.leaseSeconds ?? DEFAULT_LEASE_SECONDS;
  const leaseExpiresAt = new Date(now.getTime() + leaseSeconds * 1000);

  // The first heartbeat that names a stage is what turns `claimed` into
  // `running`: a run stuck at `claimed` is a runner that died between taking the
  // lease and starting work, which is a different failure from one that died
  // mid-stage, and the board should be able to tell them apart.
  const startedWork = Boolean(parsed.data.stage);
  const status = lease.run.status === 'claimed' && startedWork ? 'running' : lease.run.status;

  const progress = {
    ...(lease.run.progress ?? {}),
    ...(parsed.data.stage !== undefined ? { stage: parsed.data.stage } : {}),
    ...(parsed.data.stageIndex !== undefined ? { stageIndex: parsed.data.stageIndex } : {}),
    ...(parsed.data.stageCount !== undefined ? { stageCount: parsed.data.stageCount } : {}),
    ...(parsed.data.note !== undefined ? { note: parsed.data.note } : {})
  };

  await db
    .update(pipelineRuns)
    .set({
      status,
      progress,
      heartbeatAt: now,
      leaseExpiresAt,
      updatedAt: now,
      ...(status === 'running' && !lease.run.startedAt ? { startedAt: now } : {}),
      ...(parsed.data.externalRunId ? { externalRunId: parsed.data.externalRunId } : {})
    })
    .where(eq(pipelineRuns.id, id));

  return NextResponse.json({
    ok: true,
    status,
    leaseExpiresAt: leaseExpiresAt.toISOString(),
    cancelRequested: Boolean(lease.run.cancelRequestedAt)
  });
}
