import 'server-only';

import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm';

import { activePipelineRunStatuses, type PipelineRunKind, type PipelineRunStatus } from '@/content/internal';
import { db } from '@/server/db/client';
import { bets, pipelineRunEvents, pipelineRunners, pipelineRuns, users } from '@/server/db/schema';

// Panel-side reads. Uncached on purpose: the panel must see a write the moment
// it lands, and it is a handful of authenticated users, not public traffic
// (ADR-010 — the panel talks to the database directly, never through its own API).

export type PipelineRunListRow = {
  id: string;
  kind: PipelineRunKind;
  status: PipelineRunStatus;
  betId: string | null;
  betSlug: string | null;
  betTitle: string | null;
  externalRunId: string | null;
  retryAfter: Date | null;
  progress: Record<string, unknown>;
  error: string | null;
  attempt: number;
  maxAttempts: number;
  runnerId: string | null;
  requestedByName: string | null;
  cancelRequestedAt: Date | null;
  queuedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  heartbeatAt: Date | null;
  leaseExpiresAt: Date | null;
};

const listSelection = {
  id: pipelineRuns.id,
  kind: pipelineRuns.kind,
  status: pipelineRuns.status,
  betId: pipelineRuns.betId,
  betSlug: bets.slug,
  betTitle: bets.title,
  externalRunId: pipelineRuns.externalRunId,
  retryAfter: pipelineRuns.retryAfter,
  progress: pipelineRuns.progress,
  error: pipelineRuns.error,
  attempt: pipelineRuns.attempt,
  maxAttempts: pipelineRuns.maxAttempts,
  runnerId: pipelineRuns.runnerId,
  requestedByName: users.name,
  cancelRequestedAt: pipelineRuns.cancelRequestedAt,
  queuedAt: pipelineRuns.queuedAt,
  startedAt: pipelineRuns.startedAt,
  finishedAt: pipelineRuns.finishedAt,
  heartbeatAt: pipelineRuns.heartbeatAt,
  leaseExpiresAt: pipelineRuns.leaseExpiresAt
};

export async function listRuns(filters: { status?: PipelineRunStatus; kind?: PipelineRunKind; limit?: number } = {}): Promise<PipelineRunListRow[]> {
  const conditions = [
    filters.status ? eq(pipelineRuns.status, filters.status) : undefined,
    filters.kind ? eq(pipelineRuns.kind, filters.kind) : undefined
  ].filter(Boolean);

  return db
    .select(listSelection)
    .from(pipelineRuns)
    // leftJoin, not innerJoin: a discovery run has no bet, and an inner join
    // would silently hide exactly the runs this page exists to show.
    .leftJoin(bets, eq(bets.id, pipelineRuns.betId))
    .leftJoin(users, eq(users.id, pipelineRuns.requestedById))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(pipelineRuns.createdAt))
    .limit(filters.limit ?? 100) as Promise<PipelineRunListRow[]>;
}

export async function getRun(id: string): Promise<(PipelineRunListRow & { params: Record<string, unknown>; result: Record<string, unknown> | null; logUrl: string | null; betStatus: string }) | null> {
  const [row] = await db
    .select({
      ...listSelection,
      params: pipelineRuns.params,
      result: pipelineRuns.result,
      logUrl: pipelineRuns.logUrl,
      betStatus: bets.status
    })
    .from(pipelineRuns)
    .leftJoin(bets, eq(bets.id, pipelineRuns.betId))
    .leftJoin(users, eq(users.id, pipelineRuns.requestedById))
    .where(eq(pipelineRuns.id, id))
    .limit(1);

  return (row as never) ?? null;
}

export async function getRunsForBet(betId: string): Promise<PipelineRunListRow[]> {
  return db
    .select(listSelection)
    .from(pipelineRuns)
    .leftJoin(bets, eq(bets.id, pipelineRuns.betId))
    .leftJoin(users, eq(users.id, pipelineRuns.requestedById))
    .where(eq(pipelineRuns.betId, betId))
    .orderBy(desc(pipelineRuns.createdAt))
    .limit(25) as Promise<PipelineRunListRow[]>;
}

/**
 * The run currently holding the queue slot for this bet and kind, if any.
 * Mirrors the partial unique index `pipeline_runs_one_active`; keep both in step.
 */
export async function getActiveRunForBet(betId: string, kind: PipelineRunKind) {
  const [row] = await db
    .select({ id: pipelineRuns.id, status: pipelineRuns.status, kind: pipelineRuns.kind })
    .from(pipelineRuns)
    .where(
      and(
        eq(pipelineRuns.betId, betId),
        eq(pipelineRuns.kind, kind),
        inArray(pipelineRuns.status, [...activePipelineRunStatuses])
      )
    )
    .limit(1);

  return row ?? null;
}

/**
 * Timeline events, optionally only those after `sinceIso`.
 *
 * The `since` filter is what makes the panel's 5-second poll cheap: an
 * hours-long run accumulates thousands of events and refetching all of them
 * every tick would be the most expensive thing the panel does.
 */
export async function getRunEvents(runId: string, sinceIso?: string) {
  const since = sinceIso ? new Date(sinceIso) : null;
  const conditions = [eq(pipelineRunEvents.runId, runId), since && !Number.isNaN(since.valueOf()) ? gt(pipelineRunEvents.at, since) : undefined].filter(Boolean);

  return db
    .select()
    .from(pipelineRunEvents)
    .where(and(...conditions))
    .orderBy(pipelineRunEvents.at, pipelineRunEvents.id)
    .limit(500);
}

/**
 * Every machine that has ever polled for work, most recently seen first.
 *
 * The Runs list answers "what happened to my jobs"; this answers the question
 * that has to be asked first — "is anything listening at all". An idle queue and
 * a dead laptop look identical without it.
 */
export async function listRunners() {
  return db.select().from(pipelineRunners).orderBy(desc(pipelineRunners.lastSeenAt)).limit(10);
}

/** Counts by status, for the Runs list filter chips. */
export async function countRunsByStatus(): Promise<Record<string, number>> {
  const rows = await db
    .select({ status: pipelineRuns.status, count: sql<number>`count(*)::int` })
    .from(pipelineRuns)
    .groupBy(pipelineRuns.status);

  return Object.fromEntries(rows.map((row) => [row.status, row.count]));
}
