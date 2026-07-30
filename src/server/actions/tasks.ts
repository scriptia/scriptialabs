'use server';

import { revalidatePath } from 'next/cache';
import { eq, sql } from 'drizzle-orm';

import { requireUser } from '@/server/auth/guard';
import { recordAudit } from '@/server/audit';
import { db } from '@/server/db/client';
import { bets, betTasks } from '@/server/db/schema';
import { taskSchema } from '@/server/validation/tasks';

export type DetailState = { error?: string };

// Same shape as revalidateBet in bet-details.ts — duplicated rather than
// imported, since tasks now revalidate the calendar unconditionally and the
// bet path only when one is linked.
async function slugFor(betId: string) {
  const [row] = await db.select({ slug: bets.slug }).from(bets).where(eq(bets.id, betId)).limit(1);

  return row?.slug ?? null;
}

async function revalidateTask(betId: string | null) {
  if (betId) {
    const slug = await slugFor(betId);

    if (slug) {
      revalidatePath(`/internal/bets/${slug}`);
    }

    revalidatePath('/internal/bets');
    await db.update(bets).set({ updatedAt: new Date() }).where(eq(bets.id, betId));
  }

  revalidatePath('/internal/calendar');
}

export async function createTask(_state: DetailState, formData: FormData): Promise<DetailState> {
  const user = await requireUser();
  const parsed = taskSchema.safeParse({
    betId: formData.get('betId') ?? '',
    title: formData.get('title') ?? '',
    kind: formData.get('kind') ?? 'general',
    assigneeId: formData.get('assigneeId') ?? '',
    dueOn: formData.get('dueOn') ?? ''
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the task.' };
  }

  const [{ next }] = parsed.data.betId
    ? await db.select({ next: sql<number>`coalesce(max(${betTasks.sortOrder}), -1) + 1` }).from(betTasks).where(eq(betTasks.betId, parsed.data.betId))
    : [{ next: 0 }];

  const [created] = await db
    .insert(betTasks)
    .values({ ...parsed.data, sortOrder: Number(next) })
    .returning({ id: betTasks.id });

  await recordAudit({ actorId: user.id, entity: 'bet_task', entityId: created.id, action: 'create', diff: { title: { from: null, to: parsed.data.title } } });
  await revalidateTask(parsed.data.betId);

  return {};
}

export async function toggleTask(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get('id') ?? '');

  if (!id) {
    return;
  }

  const [current] = await db.select({ betId: betTasks.betId, done: betTasks.done }).from(betTasks).where(eq(betTasks.id, id)).limit(1);

  if (!current) {
    return;
  }

  const done = !current.done;

  await db
    .update(betTasks)
    .set({ done, completedAt: done ? new Date() : null })
    .where(eq(betTasks.id, id));

  await recordAudit({ actorId: user.id, entity: 'bet_task', entityId: id, action: 'update', diff: { done: { from: current.done, to: done } } });
  await revalidateTask(current.betId);
}

export async function deleteTask(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get('id') ?? '');

  if (!id) {
    return;
  }

  const [removed] = await db.delete(betTasks).where(eq(betTasks.id, id)).returning({ betId: betTasks.betId, title: betTasks.title });

  if (!removed) {
    return;
  }

  await recordAudit({ actorId: user.id, entity: 'bet_task', entityId: id, action: 'delete', diff: { title: { from: removed.title, to: null } } });
  await revalidateTask(removed.betId);
}
