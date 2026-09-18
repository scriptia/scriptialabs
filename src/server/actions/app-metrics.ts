'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';

import { requireUser } from '@/server/auth/guard';
import { recordAudit } from '@/server/audit';
import { db } from '@/server/db/client';
import { apps, appFunnelMetrics } from '@/server/db/schema';
import { funnelEntrySchema } from '@/server/validation/app-metrics';

export type FunnelFormState = { error?: string };

async function slugFor(appId: string) {
  const [row] = await db.select({ slug: apps.slug }).from(apps).where(eq(apps.id, appId)).limit(1);

  return row?.slug ?? null;
}

// One row per (app, week): submitting an existing week updates it in place,
// same upsert-by-natural-key reasoning as onboardApp for the apps table
// itself — a human re-entering last week's numbers to fix a typo should
// overwrite, not duplicate.
export async function upsertFunnelEntry(_state: FunnelFormState, formData: FormData): Promise<FunnelFormState> {
  const user = await requireUser();
  const parsed = funnelEntrySchema.safeParse({
    appId: formData.get('appId') ?? '',
    periodStart: formData.get('periodStart') ?? '',
    tiktokViews: formData.get('tiktokViews') ?? '0',
    tiktokProfileVisits: formData.get('tiktokProfileVisits') ?? '0',
    tiktokLinkClicks: formData.get('tiktokLinkClicks') ?? '0',
    appStoreProductPageViews: formData.get('appStoreProductPageViews') ?? '0',
    appStoreDownloads: formData.get('appStoreDownloads') ?? '0',
    notes: formData.get('notes') ?? ''
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the numbers.' };
  }

  const { appId, periodStart, ...values } = parsed.data;

  const [existing] = await db
    .select({ id: appFunnelMetrics.id })
    .from(appFunnelMetrics)
    .where(and(eq(appFunnelMetrics.appId, appId), eq(appFunnelMetrics.periodStart, periodStart)))
    .limit(1);

  if (existing) {
    await db.update(appFunnelMetrics).set({ ...values, updatedAt: new Date() }).where(eq(appFunnelMetrics.id, existing.id));
    await recordAudit({ actorId: user.id, entity: 'app_funnel_metrics', entityId: existing.id, action: 'update', diff: { periodStart: { from: periodStart, to: periodStart } } });
  } else {
    const [created] = await db
      .insert(appFunnelMetrics)
      .values({ appId, periodStart, ...values })
      .returning({ id: appFunnelMetrics.id });
    await recordAudit({ actorId: user.id, entity: 'app_funnel_metrics', entityId: created.id, action: 'create', diff: { periodStart: { from: null, to: periodStart } } });
  }

  const slug = await slugFor(appId);

  if (slug) {
    revalidatePath(`/internal/metrics/${slug}`);
  }

  revalidatePath('/internal/metrics');

  return {};
}

export async function deleteFunnelEntry(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get('id') ?? '');

  if (!id) {
    return;
  }

  const [removed] = await db.delete(appFunnelMetrics).where(eq(appFunnelMetrics.id, id)).returning({ appId: appFunnelMetrics.appId, periodStart: appFunnelMetrics.periodStart });

  if (!removed) {
    return;
  }

  await recordAudit({ actorId: user.id, entity: 'app_funnel_metrics', entityId: id, action: 'delete', diff: { periodStart: { from: removed.periodStart, to: null } } });

  const slug = await slugFor(removed.appId);

  if (slug) {
    revalidatePath(`/internal/metrics/${slug}`);
  }

  revalidatePath('/internal/metrics');
}
