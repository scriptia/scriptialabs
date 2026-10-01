import 'server-only';

import { and, inArray, isNotNull, lt } from 'drizzle-orm';

import { recordAudit } from '@/server/audit';
import { db } from '@/server/db/client';
import { pipelineRunEvents, pipelineRuns } from '@/server/db/schema';
import { reapRun, releaseExpiredAccountLeases, type ReapOutcome } from './queue';

// Frees leases that lapsed without a completion.
//
// The failure it exists for: a laptop closes mid-run. Nothing calls /complete,
// the row sits at `running` forever, and the partial unique index keeps the
// trigger button unusable because a run "is already in flight".
//
// Called LAZILY, at the two moments anybody could care:
//
//   * POST /api/runs/claim — a runner asking for work. This is the one that
//     matters: the runner polls every ~20s, so a wedged run is freed within one
//     poll of someone actually wanting it.
//   * the panel's Runs list — an admin looking at the board.
//
// Plus a daily cron as a backstop for the case where nobody polls and nobody
// looks. Lazy rather than purely scheduled because Vercel's Hobby plan caps
// cron at once per day, and a 24-hour wait to unstick a bet would make the
// lease pointless — but it is also just better: reaping when someone needs the
// slot beats reaping on a timer that is usually early or late.

// No `rewound` counter: reaping a run moves no bet. A product-agent run leaves
// its bet in `backlog` for its whole life, so a dead runner has nothing to undo
// — the trigger button comes back the moment the run row stops being active.
export type ReapResult = { expired: number; requeued: number; paused: number; cancelled: number; accountLeases: number };

// Bounds the work any single request does. A lazy reaper must never turn one
// runner's poll into an unbounded scan.
const MAX_PER_PASS = 25;

// Three lapsed leases and the run is given up on. `attempt` counts exactly
// these (queue.ts) — never claims, never pauses.
function nextStatus(run: { attempt: number; maxAttempts: number; cancelRequestedAt: Date | null; checkpoint: unknown }): ReapOutcome {
  // A stop pressed while the runner was dying must still stop the run. Before,
  // the reaper re-queued it and the next claim ran it again.
  if (run.cancelRequestedAt) return 'cancelled';
  if (run.attempt + 1 >= run.maxAttempts) return 'expired';
  // A checkpoint means work to resume, on any machine: that is `paused`, and
  // the claim query prefers paused runs and prefers handing this one back to
  // the machine that last held it.
  return run.checkpoint ? 'paused' : 'queued';
}

export async function reapExpiredRuns(): Promise<ReapResult> {
  const now = new Date();
  const result: ReapResult = { expired: 0, requeued: 0, paused: 0, cancelled: 0, accountLeases: 0 };

  const stale = await db
    .select({
      id: pipelineRuns.id,
      status: pipelineRuns.status,
      attempt: pipelineRuns.attempt,
      maxAttempts: pipelineRuns.maxAttempts,
      runnerId: pipelineRuns.runnerId,
      cancelRequestedAt: pipelineRuns.cancelRequestedAt,
      checkpoint: pipelineRuns.checkpoint
    })
    .from(pipelineRuns)
    .where(and(inArray(pipelineRuns.status, ['claimed', 'running']), isNotNull(pipelineRuns.leaseExpiresAt), lt(pipelineRuns.leaseExpiresAt, now)))
    .limit(MAX_PER_PASS);

  for (const run of stale) {
    const next = nextStatus(run);
    const who = run.runnerId ?? 'unknown';
    const message = {
      cancelled: `Lease expired (runner ${who} stopped reporting) after a stop was requested. Cancelled.`,
      expired: `Lease expired; runner ${who} stopped reporting. Giving up after ${run.attempt + 1} lapsed lease(s).`,
      paused: `Lease expired (runner ${who} stopped reporting). Paused — it resumes from its last checkpoint on the next claim.`,
      queued: `Lease expired (runner ${who} stopped reporting). Re-queued — lapse ${run.attempt + 1} of ${run.maxAttempts}.`
    }[next];

    // Conditional inside the statement: a heartbeat that lands between the
    // SELECT above and this write wins, and this matches nothing.
    const reaped = await reapRun({ runId: run.id, next, message });
    if (!reaped) continue;

    await db.insert(pipelineRunEvents).values({ runId: run.id, level: next === 'expired' ? 'error' : 'warn', message });

    if (next === 'expired') result.expired += 1;
    else if (next === 'cancelled') result.cancelled += 1;
    else if (next === 'paused') result.paused += 1;
    else result.requeued += 1;

    await recordAudit({
      actorId: null,
      entity: 'pipeline_run',
      entityId: run.id,
      action: 'update',
      diff: { status: { from: run.status, to: next } }
    });
  }

  result.accountLeases = await releaseExpiredAccountLeases();

  return result;
}

/**
 * Same, but never throws.
 *
 * For the lazy call sites, where reaping is a courtesy: a runner asking for work
 * should get work even if the tidy-up fails, and a panel page should render.
 */
export async function reapExpiredRunsQuietly(): Promise<ReapResult> {
  try {
    return await reapExpiredRuns();
  } catch (error) {
    console.warn('[reap] failed', error);
    return { expired: 0, requeued: 0, paused: 0, cancelled: 0, accountLeases: 0 };
  }
}
