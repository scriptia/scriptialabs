import { NextResponse, type NextRequest } from 'next/server';

import { recordAudit } from '@/server/audit';
import { requireBearerToken } from '@/server/auth/api-token';
import { db } from '@/server/db/client';
import { pipelineRunEvents } from '@/server/db/schema';
import { fenceFailure } from '@/server/pipeline/lease';
import { finishRun, pauseRun } from '@/server/pipeline/queue';
import { completeRequestSchema } from '@/server/validation/pipeline-runs';

export const runtime = 'nodejs';

// The terminal callback. After this the lease is gone and every further callback
// for this run is a 409 — which is exactly what stops a woken-up zombie process
// reporting on work that was reassigned.
//
// Fenced in the same statement as the write (server/pipeline/queue.ts), and
// that statement also releases every account the run held and closes its
// session, so a finished run can never leave an account marked in use.
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

  const parsed = completeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Payload failed validation.', issues: parsed.error.issues }, { status: 422 });
  }

  const { status, error, result, externalRunId, logUrl, retryAfterEpoch, usage } = parsed.data;
  const holder = { runnerId: parsed.data.runnerId, leaseToken: parsed.data.leaseToken ?? null };

  // `blocked` is the legacy runners' word for a limit: nothing was measured and
  // there is no outcome to record. idion-orchestrator calls /pause instead,
  // which also marks the account that ran out. A legacy runner has no account
  // and cannot restore a checkpoint, so its run goes back to `queued` behind a
  // retryAfter — the old behaviour — rather than to `paused`.
  if (status === 'blocked') {
    const retryAfter = retryAfterEpoch ? new Date(retryAfterEpoch * 1000) : new Date(Date.now() + 60 * 60 * 1000);
    const paused = await pauseRun({
      runId: id,
      holder,
      reason: error ?? 'Claude usage limit',
      resumeAfter: retryAfter,
      asStatus: 'queued',
      usage
    });
    if (!paused) return fenceFailure(id, holder);

    await db.insert(pipelineRunEvents).values({
      runId: id,
      level: 'warn',
      message: `Quota reached; nothing was measured. Re-queued, next attempt after ${retryAfter.toISOString()}.`
    });

    return NextResponse.json({ ok: true, run: { id, status: 'queued', retryAfter: retryAfter.toISOString() }, requeued: true });
  }

  const finished = await finishRun({ runId: id, holder, status, error, result, externalRunId, logUrl, usage });
  if (!finished) return fenceFailure(id, holder);

  await db.insert(pipelineRunEvents).values({
    runId: id,
    level: status === 'succeeded' ? 'info' : 'warn',
    message: status === 'succeeded' ? 'Run finished.' : `Run ${status}${error ? `: ${error.slice(0, 300)}` : '.'}`
  });

  await recordAudit({
    actorId: null,
    entity: 'pipeline_run',
    entityId: id,
    action: 'update',
    diff: { status: { from: 'running', to: status } }
  });

  // `betStatus` is always null and the key is kept on purpose: finishing a run
  // moves no bet, in any outcome, and the runner's response parser expects the
  // field.
  //
  // A SUCCEEDED run does not move the bet: the publish call is what asserts "a
  // public page exists", and it sets `ready` itself. A run can succeed having
  // published nothing (product-agent's judge returning INSUFFICIENT is a valid
  // outcome), and claiming `ready` for that would make the board lie.
  //
  // A FAILED or CANCELLED run has nothing to undo either: a product-agent run
  // leaves its bet in `backlog` for its whole life, so the trigger button is
  // already there when it dies.
  //
  // A BUILD run never moves the bet here either: its handoff calls the bet
  // status endpoint (`testing`) itself, once the app is actually in TestFlight
  // or the backend is explicitly left for a human.
  return NextResponse.json({ ok: true, run: { id, status, finishedAt: new Date().toISOString() }, betStatus: null, accountsReleased: finished.released });
}
