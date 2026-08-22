import 'server-only';

import { and, eq, inArray, isNotNull, lt } from 'drizzle-orm';

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

      // AFTER the run is marked expired, never before. releaseBet refuses to
      // touch a bet that still has an active run, and until the update above
      // lands, the run being given up on IS one — so releasing first silently
      // did nothing at all.
      //
      // The rewind is driven by THIS run expiring rather than by scanning for
      // bets that look stranded. An earlier version swept every bet in
      // `researching` or `building` with no active run and no product, which
      // could not tell a bet a dead runner had abandoned from one a human had
      // just moved there by hand — and quietly undid the human within seconds.
      if (run.betId) await releaseBet(run.betId, run.kind, now, result);
    }

    await recordAudit({
      actorId: null,
      entity: 'pipeline_run',
      entityId: run.id,
      action: 'update',
      diff: { status: { from: run.status, to: canRetry ? 'queued' : 'expired' } }
    });
  }

  return result;
}

/**
 * Releases the bet a given-up run was holding.
 *
 * Two rules, both deliberate:
 *
 *  1. **`building` is never touched.** Once a bet reaches Building it stays
 *     there until a human moves it on, or something calls the status endpoint.
 *     A build hands off artifacts and stops by design, so a bet sitting at
 *     Building is the expected resting state, not a stuck one — and nothing
 *     automated gets to second-guess that.
 *  2. Only `researching` is rewound, only when THIS run's own claim is what put
 *     it there, and only when nothing has been published. A failed re-run must
 *     never unpublish a live product.
 */
async function releaseBet(betId: string, kind: string, now: Date, result: ReapResult): Promise<void> {
  if (kind === 'build') return;

  const [bet] = await db.select({ status: bets.status }).from(bets).where(eq(bets.id, betId)).limit(1);
  if (!bet || bet.status !== 'researching') return;

  const [published] = await db.select({ id: products.id }).from(products).where(eq(products.betId, betId)).limit(1);
  if (published) return;

  // Another run may already be queued or in flight for this bet; releasing it
  // would drag the board out from under that one.
  const [active] = await db
    .select({ id: pipelineRuns.id })
    .from(pipelineRuns)
    .where(and(eq(pipelineRuns.betId, betId), inArray(pipelineRuns.status, ['queued', 'claimed', 'running'])))
    .limit(1);
  if (active) return;

  await db.update(bets).set({ status: 'backlog', updatedAt: now }).where(eq(bets.id, betId));
  await recordAudit({ actorId: null, entity: 'bet', entityId: betId, action: 'update', diff: { status: { from: 'researching', to: 'backlog' } } });
  result.rewound += 1;
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
