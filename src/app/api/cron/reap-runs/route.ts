import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, inArray, isNotNull, lt, sql } from 'drizzle-orm';

import { recordAudit } from '@/server/audit';
import { db } from '@/server/db/client';
import { bets, pipelineRunEvents, pipelineRuns, products } from '@/server/db/schema';

export const runtime = 'nodejs';

// Runs every 10 minutes from vercel.json.
//
// The failure this exists for: a laptop closes mid-run. Nothing calls
// /complete, the row sits at `running` forever, the bet sits at `researching`
// forever, and the partial unique index means the button stays unusable because
// a run "is already in flight". The lease is what makes that recoverable without
// anyone noticing something is wedged.

// Same inline check as the overdue-tasks cron: this is a Vercel Cron caller, not
// one of the token-holding agents, so it does not use requireBearerToken.
function tokenMatches(supplied: string, expected: string) {
  return timingSafeEqual(createHash('sha256').update(supplied).digest(), createHash('sha256').update(expected).digest());
}

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ ok: false, error: 'CRON_SECRET is not configured on this deployment.' }, { status: 503 });
  }

  const header = request.headers.get('authorization') ?? '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!supplied || !tokenMatches(supplied, expected)) {
    return NextResponse.json({ ok: false, error: 'Invalid or missing bearer token.' }, { status: 401 });
  }

  const now = new Date();

  const stale = await db
    .select({ id: pipelineRuns.id, betId: pipelineRuns.betId, kind: pipelineRuns.kind, status: pipelineRuns.status, attempt: pipelineRuns.attempt, maxAttempts: pipelineRuns.maxAttempts, runnerId: pipelineRuns.runnerId })
    .from(pipelineRuns)
    .where(and(inArray(pipelineRuns.status, ['claimed', 'running']), isNotNull(pipelineRuns.leaseExpiresAt), lt(pipelineRuns.leaseExpiresAt, now)));

  let expired = 0;
  let requeued = 0;
  let rewound = 0;

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
      requeued += 1;
    } else {
      await db
        .update(pipelineRuns)
        .set({ status: 'expired', leaseExpiresAt: null, finishedAt: now, updatedAt: now, error: `Lease expired; runner ${run.runnerId ?? 'unknown'} stopped reporting.` })
        .where(and(eq(pipelineRuns.id, run.id), inArray(pipelineRuns.status, ['claimed', 'running'])));
      await db.insert(pipelineRunEvents).values({
        runId: run.id,
        level: 'error',
        message: `Lease expired after ${run.attempt} attempt(s). Giving up.`
      });
      expired += 1;
    }

    await recordAudit({ actorId: null, entity: 'pipeline_run', entityId: run.id, action: 'update', diff: { status: { from: run.status, to: canRetry ? 'queued' : 'expired' } } });
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
    );

  for (const bet of orphans) {
    const rewindTo = bet.status === 'building' ? 'ready' : 'backlog';
    await db.update(bets).set({ status: rewindTo, updatedAt: now }).where(eq(bets.id, bet.id));
    await recordAudit({ actorId: null, entity: 'bet', entityId: bet.id, action: 'update', diff: { status: { from: bet.status, to: rewindTo } } });
    rewound += 1;
  }

  return NextResponse.json({ ok: true, expired, requeued, rewound });
}
