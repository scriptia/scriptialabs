import { NextResponse, type NextRequest } from 'next/server';

import { requireBearerToken } from '@/server/auth/api-token';
import { fenceFailure } from '@/server/pipeline/lease';
import { heartbeatRun } from '@/server/pipeline/queue';
import { heartbeatRequestSchema } from '@/server/validation/pipeline-runs';

export const runtime = 'nodejs';

const DEFAULT_LEASE_SECONDS = 900;

// Extends the lease and reports progress. Called every ~60s while a run works.
//
// One fenced statement (server/pipeline/queue.ts): it extends the run lease AND
// every account lease taken under it, so a run can never outlive the accounts
// it is using, or the other way round. A stale token matches nothing → 409, and
// the orchestrator kills its agent: that process's job belongs to someone else.
//
// It is also the STOP channel: the response carries `cancelRequested` (and
// `stop`, the orchestrator's name for it). There is nothing to signal — the
// runner is on a laptop behind NAT — so a stop is a reply to a poll.
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

  const holder = { runnerId: parsed.data.runnerId, leaseToken: parsed.data.leaseToken ?? null };
  const progress = {
    ...(parsed.data.stage !== undefined ? { stage: parsed.data.stage } : {}),
    ...(parsed.data.stageIndex !== undefined ? { stageIndex: parsed.data.stageIndex } : {}),
    ...(parsed.data.stageCount !== undefined ? { stageCount: parsed.data.stageCount } : {}),
    ...(parsed.data.note !== undefined ? { note: parsed.data.note } : {})
  };

  // The first heartbeat that names a stage is what turns `claimed` into
  // `running`: a run stuck at `claimed` is a runner that died between taking the
  // lease and starting work, which is a different failure from one that died
  // mid-stage, and the board should be able to tell them apart.
  const beat = await heartbeatRun({
    runId: id,
    holder,
    leaseSeconds: parsed.data.leaseSeconds ?? DEFAULT_LEASE_SECONDS,
    stage: parsed.data.stage,
    progress,
    externalRunId: parsed.data.externalRunId
  });

  if (!beat) return fenceFailure(id, holder);

  return NextResponse.json({
    ok: true,
    status: beat.status,
    leaseExpiresAt: beat.leaseExpiresAt.toISOString(),
    cancelRequested: beat.cancelRequested,
    stop: beat.cancelRequested,
    accountLeases: beat.accountLeases
  });
}
