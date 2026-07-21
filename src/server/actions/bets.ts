'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq, ne } from 'drizzle-orm';

import { requireUser } from '@/server/auth/guard';
import { buildDiff, recordAudit } from '@/server/audit';
import { db } from '@/server/db/client';
import { bets } from '@/server/db/schema';
import { betSchema } from '@/server/validation/bets';

export type FormState = { error?: string; fieldErrors?: Record<string, string> };

// Server actions receive FormData; zod's flattened errors map cleanly onto the
// per-field messages the forms render, so every action funnels through this.
function toFieldErrors(issues: Array<{ path: PropertyKey[]; message: string }>) {
  const fieldErrors: Record<string, string> = {};

  for (const issue of issues) {
    const key = String(issue.path[0] ?? '');

    if (key && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }

  return fieldErrors;
}

function readBetForm(formData: FormData) {
  return betSchema.safeParse({
    slug: formData.get('slug') ?? '',
    title: formData.get('title') ?? '',
    description: formData.get('description') ?? '',
    status: formData.get('status') ?? 'backlog',
    audience: formData.get('audience') ?? 'b2c',
    priority: formData.get('priority') ?? 'medium',
    ownerId: formData.get('ownerId') ?? '',
    publicSlug: formData.get('publicSlug') ?? '',
    nextAction: formData.get('nextAction') ?? '',
    startedAt: formData.get('startedAt') ?? '',
    targetDate: formData.get('targetDate') ?? ''
  });
}

export async function createBet(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = readBetForm(formData);

  if (!parsed.success) {
    return { error: 'Check the highlighted fields.', fieldErrors: toFieldErrors(parsed.error.issues) };
  }

  const [existing] = await db.select({ id: bets.id }).from(bets).where(eq(bets.slug, parsed.data.slug)).limit(1);

  if (existing) {
    return { error: 'That slug is already taken.', fieldErrors: { slug: 'Already in use by another bet.' } };
  }

  const [created] = await db
    .insert(bets)
    .values({ ...parsed.data, createdById: user.id })
    .returning({ id: bets.id, slug: bets.slug });

  await recordAudit({ actorId: user.id, entity: 'bet', entityId: created.id, action: 'create', diff: buildDiff({}, parsed.data) });

  revalidatePath('/internal/bets');
  redirect(`/internal/bets/${created.slug}`);
}

export async function updateBet(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = String(formData.get('id') ?? '');

  if (!id) {
    return { error: 'Missing bet reference.' };
  }

  const parsed = readBetForm(formData);

  if (!parsed.success) {
    return { error: 'Check the highlighted fields.', fieldErrors: toFieldErrors(parsed.error.issues) };
  }

  const [current] = await db.select().from(bets).where(eq(bets.id, id)).limit(1);

  if (!current) {
    return { error: 'That bet no longer exists.' };
  }

  const [slugClash] = await db
    .select({ id: bets.id })
    .from(bets)
    .where(and(eq(bets.slug, parsed.data.slug), ne(bets.id, id)))
    .limit(1);

  if (slugClash) {
    return { error: 'That slug is already taken.', fieldErrors: { slug: 'Already in use by another bet.' } };
  }

  await db
    .update(bets)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(bets.id, id));

  await recordAudit({ actorId: user.id, entity: 'bet', entityId: id, action: 'update', diff: buildDiff(current, parsed.data) });

  revalidatePath('/internal/bets');
  redirect(`/internal/bets/${parsed.data.slug}`);
}

// Status changes happen constantly from the board and the detail header, so they
// get their own narrow action rather than round-tripping the whole edit form.
export async function setBetStatus(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get('id') ?? '');
  const parsed = betSchema.shape.status.safeParse(formData.get('status'));

  if (!id || !parsed.success) {
    return;
  }

  const [current] = await db.select({ status: bets.status, slug: bets.slug }).from(bets).where(eq(bets.id, id)).limit(1);

  if (!current || current.status === parsed.data) {
    return;
  }

  await db.update(bets).set({ status: parsed.data, updatedAt: new Date() }).where(eq(bets.id, id));

  await recordAudit({
    actorId: user.id,
    entity: 'bet',
    entityId: id,
    action: 'update',
    diff: { status: { from: current.status, to: parsed.data } }
  });

  revalidatePath('/internal/bets');
  revalidatePath('/internal/bets/board');
  revalidatePath(`/internal/bets/${current.slug}`);
}

// Bets are archived, never deleted — the updates, metrics and audit trail on a
// killed bet are exactly the history worth keeping.
export async function toggleArchiveBet(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get('id') ?? '');

  if (!id) {
    return;
  }

  const [current] = await db.select({ archivedAt: bets.archivedAt, slug: bets.slug }).from(bets).where(eq(bets.id, id)).limit(1);

  if (!current) {
    return;
  }

  const archivedAt = current.archivedAt ? null : new Date();

  await db.update(bets).set({ archivedAt, updatedAt: new Date() }).where(eq(bets.id, id));

  await recordAudit({
    actorId: user.id,
    entity: 'bet',
    entityId: id,
    action: 'update',
    diff: { archivedAt: { from: current.archivedAt?.toISOString() ?? null, to: archivedAt?.toISOString() ?? null } }
  });

  revalidatePath('/internal/bets');
  revalidatePath(`/internal/bets/${current.slug}`);
}
