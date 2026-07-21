'use server';

import { revalidatePath } from 'next/cache';
import { eq, sql } from 'drizzle-orm';

import { requireUser } from '@/server/auth/guard';
import { recordAudit } from '@/server/audit';
import { db } from '@/server/db/client';
import { betLinks, betMetrics, bets, betTasks, betUpdates } from '@/server/db/schema';
import { betLinkSchema, betMetricSchema, betTaskSchema, betUpdateSchema } from '@/server/validation/bets';

export type DetailState = { error?: string };

// All of these actions revalidate the bet's detail page by slug, which they have
// to look up from the bet id the form carries. One extra indexed read per
// mutation, and it keeps the forms from having to pass the slug around.
async function slugFor(betId: string) {
  const [row] = await db.select({ slug: bets.slug }).from(bets).where(eq(bets.id, betId)).limit(1);

  return row?.slug ?? null;
}

async function revalidateBet(betId: string) {
  const slug = await slugFor(betId);

  if (slug) {
    revalidatePath(`/internal/bets/${slug}`);
  }

  revalidatePath('/internal/bets');
}

// Touch the parent bet so the list's "last activity" ordering reflects link,
// update, metric and task activity — not just edits to the bet's own fields.
async function touchBet(betId: string) {
  await db.update(bets).set({ updatedAt: new Date() }).where(eq(bets.id, betId));
}

export async function addBetLink(_state: DetailState, formData: FormData): Promise<DetailState> {
  const user = await requireUser();
  const parsed = betLinkSchema.safeParse({
    betId: formData.get('betId'),
    kind: formData.get('kind'),
    label: formData.get('label') ?? '',
    url: formData.get('url') ?? ''
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the link details.' };
  }

  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${betLinks.sortOrder}), -1) + 1` })
    .from(betLinks)
    .where(eq(betLinks.betId, parsed.data.betId));

  const [created] = await db
    .insert(betLinks)
    .values({ ...parsed.data, sortOrder: Number(next) })
    .returning({ id: betLinks.id });

  await recordAudit({ actorId: user.id, entity: 'bet_link', entityId: created.id, action: 'create', diff: { url: { from: null, to: parsed.data.url } } });
  await touchBet(parsed.data.betId);
  await revalidateBet(parsed.data.betId);

  return {};
}

export async function deleteBetLink(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get('id') ?? '');

  if (!id) {
    return;
  }

  const [removed] = await db.delete(betLinks).where(eq(betLinks.id, id)).returning({ betId: betLinks.betId, url: betLinks.url });

  if (!removed) {
    return;
  }

  await recordAudit({ actorId: user.id, entity: 'bet_link', entityId: id, action: 'delete', diff: { url: { from: removed.url, to: null } } });
  await revalidateBet(removed.betId);
}

export async function addBetUpdate(_state: DetailState, formData: FormData): Promise<DetailState> {
  const user = await requireUser();
  const parsed = betUpdateSchema.safeParse({
    betId: formData.get('betId'),
    kind: formData.get('kind'),
    body: formData.get('body') ?? ''
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the update.' };
  }

  const [created] = await db
    .insert(betUpdates)
    .values({ ...parsed.data, authorId: user.id })
    .returning({ id: betUpdates.id });

  await recordAudit({ actorId: user.id, entity: 'bet_update', entityId: created.id, action: 'create' });
  await touchBet(parsed.data.betId);
  await revalidateBet(parsed.data.betId);

  return {};
}

export async function addBetMetric(_state: DetailState, formData: FormData): Promise<DetailState> {
  const user = await requireUser();
  const parsed = betMetricSchema.safeParse({
    betId: formData.get('betId'),
    metricKey: formData.get('metricKey') ?? '',
    value: formData.get('value') ?? '',
    unit: formData.get('unit') ?? '',
    recordedOn: formData.get('recordedOn') ?? '',
    note: formData.get('note') ?? ''
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the snapshot.' };
  }

  // Re-entering the same metric for the same day corrects the existing point
  // rather than adding a second one — see the unique index on bet_metrics.
  const [saved] = await db
    .insert(betMetrics)
    .values({ ...parsed.data, value: String(parsed.data.value) })
    .onConflictDoUpdate({
      target: [betMetrics.betId, betMetrics.metricKey, betMetrics.recordedOn],
      set: { value: String(parsed.data.value), unit: parsed.data.unit, note: parsed.data.note }
    })
    .returning({ id: betMetrics.id });

  await recordAudit({
    actorId: user.id,
    entity: 'bet_metric',
    entityId: saved.id,
    action: 'create',
    diff: { [parsed.data.metricKey]: { from: null, to: parsed.data.value } }
  });
  await touchBet(parsed.data.betId);
  await revalidateBet(parsed.data.betId);

  return {};
}

export async function deleteBetMetric(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get('id') ?? '');

  if (!id) {
    return;
  }

  const [removed] = await db.delete(betMetrics).where(eq(betMetrics.id, id)).returning({ betId: betMetrics.betId, metricKey: betMetrics.metricKey });

  if (!removed) {
    return;
  }

  await recordAudit({ actorId: user.id, entity: 'bet_metric', entityId: id, action: 'delete', diff: { [removed.metricKey]: { from: 'recorded', to: null } } });
  await revalidateBet(removed.betId);
}

export async function addBetTask(_state: DetailState, formData: FormData): Promise<DetailState> {
  const user = await requireUser();
  const parsed = betTaskSchema.safeParse({
    betId: formData.get('betId'),
    title: formData.get('title') ?? '',
    assigneeId: formData.get('assigneeId') ?? '',
    dueOn: formData.get('dueOn') ?? ''
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the task.' };
  }

  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${betTasks.sortOrder}), -1) + 1` })
    .from(betTasks)
    .where(eq(betTasks.betId, parsed.data.betId));

  const [created] = await db
    .insert(betTasks)
    .values({ ...parsed.data, sortOrder: Number(next) })
    .returning({ id: betTasks.id });

  await recordAudit({ actorId: user.id, entity: 'bet_task', entityId: created.id, action: 'create', diff: { title: { from: null, to: parsed.data.title } } });
  await touchBet(parsed.data.betId);
  await revalidateBet(parsed.data.betId);

  return {};
}

export async function toggleBetTask(formData: FormData) {
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
  await revalidateBet(current.betId);
}

export async function deleteBetTask(formData: FormData) {
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
  await revalidateBet(removed.betId);
}
