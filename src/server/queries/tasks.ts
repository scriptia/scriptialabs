import 'server-only';

import { and, asc, eq, gte, isNull, lt, lte, or } from 'drizzle-orm';

import { db } from '@/server/db/client';
import { bets, betTasks, users } from '@/server/db/schema';

// All tasks due within a date range (inclusive), for the calendar's month
// grid. Left-joined so a task with no bet or no assignee still renders.
export async function getCalendarTasks({ from, to }: { from: string; to: string }) {
  return db
    .select({
      id: betTasks.id,
      title: betTasks.title,
      kind: betTasks.kind,
      done: betTasks.done,
      dueOn: betTasks.dueOn,
      assigneeId: betTasks.assigneeId,
      assigneeName: users.name,
      betId: betTasks.betId,
      betSlug: bets.slug,
      betTitle: bets.title
    })
    .from(betTasks)
    .leftJoin(users, eq(betTasks.assigneeId, users.id))
    .leftJoin(bets, eq(betTasks.betId, bets.id))
    .where(and(gte(betTasks.dueOn, from), lte(betTasks.dueOn, to)))
    .orderBy(asc(betTasks.dueOn), asc(betTasks.createdAt));
}

export type CalendarTaskRow = Awaited<ReturnType<typeof getCalendarTasks>>[number];

// Tasks that are overdue, unfinished, assigned to someone with an email on
// file, and not already notified today — the exact set the cron route emails.
export async function getOverdueTasks() {
  const today = new Date().toISOString().slice(0, 10);
  const notifiedCutoff = new Date(Date.now() - 20 * 60 * 60 * 1000);

  return db
    .select({
      id: betTasks.id,
      title: betTasks.title,
      dueOn: betTasks.dueOn,
      assigneeEmail: users.email,
      assigneeName: users.name,
      betTitle: bets.title
    })
    .from(betTasks)
    .innerJoin(users, eq(betTasks.assigneeId, users.id))
    .leftJoin(bets, eq(betTasks.betId, bets.id))
    .where(
      and(
        lt(betTasks.dueOn, today),
        eq(betTasks.done, false),
        or(isNull(betTasks.notifiedOverdueAt), lt(betTasks.notifiedOverdueAt, notifiedCutoff))
      )
    );
}

export type OverdueTaskRow = Awaited<ReturnType<typeof getOverdueTasks>>[number];

// For the "link to a bet" dropdown on the task form — small list, no
// pagination needed at current bet volume.
export async function listBetsForSelect() {
  return db
    .select({ id: bets.id, slug: bets.slug, title: bets.title })
    .from(bets)
    .where(isNull(bets.archivedAt))
    .orderBy(asc(bets.title));
}
