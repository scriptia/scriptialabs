import 'server-only';

import { and, asc, count, desc, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';

import { betStatuses, dormantBetStatuses, type BetAudience, type BetStatus } from '@/content/internal';
import { db } from '@/server/db/client';
import { betDocuments, betLinks, betMetrics, bets, betTasks, betUpdates, users } from '@/server/db/schema';

export type BetFilters = {
  status?: BetStatus;
  audience?: BetAudience;
  ownerId?: string;
  q?: string;
  includeArchived?: boolean;
};

function filterConditions(filters: BetFilters) {
  const conditions: SQL[] = [];

  if (!filters.includeArchived) {
    conditions.push(isNull(bets.archivedAt));
  }

  if (filters.status) {
    conditions.push(eq(bets.status, filters.status));
  }

  if (filters.audience) {
    conditions.push(eq(bets.audience, filters.audience));
  }

  if (filters.ownerId) {
    conditions.push(eq(bets.ownerId, filters.ownerId));
  }

  if (filters.q) {
    const pattern = `%${filters.q}%`;
    const search = or(ilike(bets.title, pattern), ilike(bets.slug, pattern), ilike(bets.description, pattern));

    if (search) {
      conditions.push(search);
    }
  }

  return conditions;
}

// One row per bet with the owner joined — the list and board views both render
// the owner's name, and doing it in SQL avoids an N+1 over a serverless HTTP
// driver where every round trip costs a request.
export async function listBets(filters: BetFilters = {}) {
  const conditions = filterConditions(filters);

  return db
    .select({
      id: bets.id,
      slug: bets.slug,
      title: bets.title,
      description: bets.description,
      status: bets.status,
      audience: bets.audience,
      priority: bets.priority,
      nextAction: bets.nextAction,
      targetDate: bets.targetDate,
      archivedAt: bets.archivedAt,
      updatedAt: bets.updatedAt,
      ownerId: bets.ownerId,
      ownerName: users.name
    })
    .from(bets)
    .leftJoin(users, eq(bets.ownerId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(bets.updatedAt));
}

export type BetListItem = Awaited<ReturnType<typeof listBets>>[number];

export async function getBetBySlug(slug: string) {
  const [row] = await db
    .select({
      bet: bets,
      ownerName: users.name
    })
    .from(bets)
    .leftJoin(users, eq(bets.ownerId, users.id))
    .where(eq(bets.slug, slug))
    .limit(1);

  return row ? { ...row.bet, ownerName: row.ownerName } : null;
}

export type BetDetail = NonNullable<Awaited<ReturnType<typeof getBetBySlug>>>;

export async function getBetLinks(betId: string) {
  return db.select().from(betLinks).where(eq(betLinks.betId, betId)).orderBy(asc(betLinks.sortOrder), asc(betLinks.createdAt));
}

// Deliberately excludes `content`: a build prompt is tens of KB and the detail
// page lists documents before anyone asks to read one. The body is fetched on
// demand by getBetDocument below.
export async function getBetDocuments(betId: string) {
  return db
    .select({ id: betDocuments.id, kind: betDocuments.kind, name: betDocuments.name, updatedAt: betDocuments.updatedAt, size: sql<number>`length(${betDocuments.content})` })
    .from(betDocuments)
    .where(eq(betDocuments.betId, betId))
    .orderBy(asc(betDocuments.kind));
}

export async function getBetDocument(id: string) {
  const [row] = await db.select().from(betDocuments).where(eq(betDocuments.id, id)).limit(1);

  return row ?? null;
}

export async function getBetUpdates(betId: string) {
  return db
    .select({
      id: betUpdates.id,
      kind: betUpdates.kind,
      body: betUpdates.body,
      createdAt: betUpdates.createdAt,
      authorName: users.name
    })
    .from(betUpdates)
    .leftJoin(users, eq(betUpdates.authorId, users.id))
    .where(eq(betUpdates.betId, betId))
    .orderBy(desc(betUpdates.createdAt));
}

export async function getBetMetrics(betId: string) {
  // Ascending by date so the caller can chart the series without re-sorting.
  return db.select().from(betMetrics).where(eq(betMetrics.betId, betId)).orderBy(asc(betMetrics.metricKey), asc(betMetrics.recordedOn));
}

export async function getBetTasks(betId: string) {
  return db
    .select({
      id: betTasks.id,
      title: betTasks.title,
      done: betTasks.done,
      dueOn: betTasks.dueOn,
      sortOrder: betTasks.sortOrder,
      assigneeId: betTasks.assigneeId,
      assigneeName: users.name
    })
    .from(betTasks)
    .leftJoin(users, eq(betTasks.assigneeId, users.id))
    .where(eq(betTasks.betId, betId))
    .orderBy(asc(betTasks.done), asc(betTasks.sortOrder), asc(betTasks.createdAt));
}

export async function listActiveUsers() {
  return db.select({ id: users.id, name: users.name, username: users.username }).from(users).where(eq(users.active, true)).orderBy(asc(users.name));
}

// Groups the bets into board columns in memory rather than issuing one query
// per status — the whole active set is small enough that a single scan wins.
export async function getBoard(filters: BetFilters = {}) {
  const rows = await listBets(filters);

  return betStatuses.map((status) => ({
    status,
    bets: rows.filter((row) => row.status === status)
  }));
}

const STALE_AFTER_DAYS = 14;

export async function getDashboard() {
  const [statusCounts, recentUpdates, openTasks, activeBets] = await Promise.all([
    db.select({ status: bets.status, total: count() }).from(bets).where(isNull(bets.archivedAt)).groupBy(bets.status),
    db
      .select({
        id: betUpdates.id,
        kind: betUpdates.kind,
        body: betUpdates.body,
        createdAt: betUpdates.createdAt,
        authorName: users.name,
        betSlug: bets.slug,
        betTitle: bets.title
      })
      .from(betUpdates)
      .innerJoin(bets, eq(betUpdates.betId, bets.id))
      .leftJoin(users, eq(betUpdates.authorId, users.id))
      .orderBy(desc(betUpdates.createdAt))
      .limit(10),
    db
      .select({
        id: betTasks.id,
        title: betTasks.title,
        dueOn: betTasks.dueOn,
        betSlug: bets.slug,
        betTitle: bets.title,
        assigneeName: users.name
      })
      .from(betTasks)
      .innerJoin(bets, eq(betTasks.betId, bets.id))
      .leftJoin(users, eq(betTasks.assigneeId, users.id))
      .where(and(eq(betTasks.done, false), isNull(bets.archivedAt)))
      .orderBy(asc(betTasks.dueOn))
      .limit(10),
    listBets()
  ]);

  // "Stale" = actively-owned work with no update in two weeks. This is the
  // signal a spreadsheet structurally cannot give you, so it leads the dashboard.
  const staleThreshold = Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  const latestUpdates = await db.select({ betId: betUpdates.betId, latest: betUpdates.createdAt }).from(betUpdates).orderBy(desc(betUpdates.createdAt));
  const latestByBet = new Map<string, Date>();

  for (const row of latestUpdates) {
    if (!latestByBet.has(row.betId)) {
      latestByBet.set(row.betId, row.latest);
    }
  }

  const stale = activeBets
    .filter((bet) => !dormantBetStatuses.includes(bet.status))
    .map((bet) => ({ ...bet, lastUpdateAt: latestByBet.get(bet.id) ?? null }))
    .filter((bet) => (bet.lastUpdateAt ? bet.lastUpdateAt.getTime() : bet.updatedAt.getTime()) < staleThreshold)
    .sort((a, b) => (a.lastUpdateAt?.getTime() ?? 0) - (b.lastUpdateAt?.getTime() ?? 0));

  return {
    statusCounts: Object.fromEntries(statusCounts.map((row) => [row.status, row.total])) as Partial<Record<BetStatus, number>>,
    totalActive: activeBets.length,
    recentUpdates,
    openTasks,
    stale,
    staleAfterDays: STALE_AFTER_DAYS
  };
}
