import 'server-only';

import { and, eq, inArray, isNotNull, lt, sql } from 'drizzle-orm';

import { recordAudit } from '@/server/audit';
import { db } from '@/server/db/client';
import { bets, pipelineRunEvents, pipelineRuns, products } from '@/server/db/schema';

// Frees leases that lapsed without a completion.
//
// The failure it exists for: a laptop closes mid-run. Nothing calls /complete,
// the row sits at `running` forever, the bet sits at `researching` forever, and
// the partial unique index keeps the trigger button unusable because a run "is
// already in flight".
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

export type ReapResult = { expired: number; requeued: number; rewound: number };

// Bounds the work any single request does. A lazy reaper must never turn one
// runner's poll into an unbounded scan.
const MAX_PER_PASS = 25;

export async function reapExpiredRuns(): Promise<ReapResult> {
  const now = new Date();
  const result: ReapResult = { expired: 0, requeued: 0, rewound: 0 };

  const stale = await db
    .select({
      id: pipelineRuns.id,
      betId: pipelineRuns.betId,
      kind: pipelineRuns.kind,
      status: pipelineRuns.status,
      attempt: pipelineRuns.attempt,
      maxAttempts: pipelineRuns.maxAttempts,
      runnerId: pipelineRuns.runnerId
    })
    .from(pipelineRuns)
    .where(and(inArray(pipelineRuns.status, ['claimed', 'running']), isNotNull(pipelineRuns.leaseExpiresAt), lt(pipelineRuns.leaseExpiresAt, now)))
    .limit(MAX_PER_PASS);

  for (const run of stale) {
    const canRetry = run.attempt < run.maxAttempts;

    if (canRetry) {
      // Back to the queue, lease cleared and runnerId dropped. Dropping the
      // runnerId is what lets a DIFFERENT runner claim it — and what makes the
      // original process's next callback a 409 rather than a silent double-write.
      await db
        .update(pipelineRuns)
        .set({ status: 'queued', runnerId: null, leaseExpiresAt: null, claimedAt: null, updatedAt: now })
        .where(and(eq(pipelineRuns.id, run.id), inArray(pipelineRuns.status, ['claimed', 'running'])));
      await db.insert(pipelineRunEvents).values({
        runId: run.id,
        level: 'warn',
        message: `Lease expired (runner ${run.runnerId ?? 'unknown'} stopped reporting). Re-queued — attempt ${run.attempt} of ${run.maxAttempts}.`
      });
      result.requeued += 1;
    } else {
      await db
        .update(pipelineRuns)
        .set({ status: 'expired', leaseExpiresAt: null, finishedAt: now, updatedAt: now, error: `Lease expired; runner ${run.runnerId ?? 'unknown'} stopped reporting.` })
        .where(and(eq(pipelineRuns.id, run.id), inArray(pipelineRuns.status, ['claimed', 'running'])));
      await db.insert(pipelineRunEvents).values({ runId: run.id, level: 'error', message: `Lease expired after ${run.attempt} attempt(s). Giving up.` });
      result.expired += 1;
    }

    await recordAudit({
      actorId: null,
      entity: 'pipeline_run',
      entityId: run.id,
      action: 'update',
      diff: { status: { from: run.status, to: canRetry ? 'queued' : 'expired' } }
    });
  }

  // A bet left mid-flight with nothing published goes back where it came from,
  // so the board is not quietly wrong and the trigger button works again.
  // Guarded on a product row existing: a failed RE-run must never unpublish a
  // live product.
  const orphans = await db
    .select({ id: bets.id, status: bets.status })
    .from(bets)
    .where(
      and(
        inArray(bets.status, ['researching', 'building']),
        sql`not exists (select 1 from ${pipelineRuns} where ${pipelineRuns.betId} = ${bets.id} and ${pipelineRuns.status} in ('queued','claimed','running'))`,
        sql`not exists (select 1 from ${products} where ${products.betId} = ${bets.id})`
      )
    )
    .limit(MAX_PER_PASS);

  for (const bet of orphans) {
    const rewindTo = bet.status === 'building' ? 'ready' : 'backlog';
    await db.update(bets).set({ status: rewindTo, updatedAt: now }).where(eq(bets.id, bet.id));
    await recordAudit({ actorId: null, entity: 'bet', entityId: bet.id, action: 'update', diff: { status: { from: bet.status, to: rewindTo } } });
    result.rewound += 1;
  }

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
    return { expired: 0, requeued: 0, rewound: 0 };
  }
}
