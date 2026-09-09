'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';

import { requireUser } from '@/server/auth/guard';
import { recordAudit } from '@/server/audit';
import { db } from '@/server/db/client';
import { appFunnelMetrics, appStoreConnectConfigs, apps } from '@/server/db/schema';
import { fetchWeeklyDownloads } from '@/server/integrations/app-store-connect';
import { decryptSecret, encryptSecret } from '@/server/integrations/crypto';
import { appStoreConnectConfigSchema } from '@/server/validation/app-store-connect';

export type AscFormState = { error?: string };

async function slugFor(appId: string) {
  const [row] = await db.select({ slug: apps.slug }).from(apps).where(eq(apps.id, appId)).limit(1);

  return row?.slug ?? null;
}

// One config per app: re-saving (e.g. to rotate a key) replaces the existing
// row rather than adding a second one, same reasoning as the funnel entry's
// upsert-by-week.
export async function saveAppStoreConnectConfig(_state: AscFormState, formData: FormData): Promise<AscFormState> {
  const user = await requireUser();
  const parsed = appStoreConnectConfigSchema.safeParse({
    appId: formData.get('appId') ?? '',
    issuerId: formData.get('issuerId') ?? '',
    keyId: formData.get('keyId') ?? '',
    privateKeyPem: formData.get('privateKeyPem') ?? '',
    vendorNumber: formData.get('vendorNumber') ?? '',
    ascAppId: formData.get('ascAppId') ?? ''
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the App Store Connect details.' };
  }

  const { appId, privateKeyPem, ...rest } = parsed.data;
  const privateKeyEncrypted = encryptSecret(privateKeyPem);

  const [existing] = await db
    .select({ id: appStoreConnectConfigs.id })
    .from(appStoreConnectConfigs)
    .where(eq(appStoreConnectConfigs.appId, appId))
    .limit(1);

  if (existing) {
    await db
      .update(appStoreConnectConfigs)
      .set({ ...rest, privateKeyEncrypted, lastSyncError: null, updatedAt: new Date() })
      .where(eq(appStoreConnectConfigs.id, existing.id));
    await recordAudit({ actorId: user.id, entity: 'app_store_connect_config', entityId: existing.id, action: 'update', diff: { keyId: { from: null, to: rest.keyId } } });
  } else {
    const [created] = await db
      .insert(appStoreConnectConfigs)
      .values({ appId, privateKeyEncrypted, ...rest })
      .returning({ id: appStoreConnectConfigs.id });
    await recordAudit({ actorId: user.id, entity: 'app_store_connect_config', entityId: created.id, action: 'create', diff: { keyId: { from: null, to: rest.keyId } } });
  }

  const slug = await slugFor(appId);

  if (slug) {
    revalidatePath(`/internal/metrics/${slug}`);
  }

  return {};
}

export async function deleteAppStoreConnectConfig(formData: FormData) {
  const user = await requireUser();
  const appId = String(formData.get('appId') ?? '');

  if (!appId) {
    return;
  }

  const [removed] = await db.delete(appStoreConnectConfigs).where(eq(appStoreConnectConfigs.appId, appId)).returning({ id: appStoreConnectConfigs.id });

  if (!removed) {
    return;
  }

  await recordAudit({ actorId: user.id, entity: 'app_store_connect_config', entityId: removed.id, action: 'delete' });

  const slug = await slugFor(appId);

  if (slug) {
    revalidatePath(`/internal/metrics/${slug}`);
  }
}

function mondayOf(date: Date): string {
  const day = date.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(date);

  monday.setUTCDate(date.getUTCDate() + diff);

  return monday.toISOString().slice(0, 10);
}

export type SyncState = { error?: string; synced?: string };

// Pulls this and last week's Units (downloads) from App Store Connect Sales
// Reports and writes them into the funnel — only appStoreDownloads, so a
// week's TikTok and product-page-view numbers already logged by hand are
// left alone. Product page views and impressions live in the newer,
// asynchronous Analytics Reports API (a report has to be requested and then
// polled over the following days) and aren't pulled yet — still manual.
export async function syncAppStoreConnect(_state: SyncState, formData: FormData): Promise<SyncState> {
  await requireUser();
  const appId = String(formData.get('appId') ?? '');

  if (!appId) {
    return { error: 'Missing app.' };
  }

  const [config] = await db.select().from(appStoreConnectConfigs).where(eq(appStoreConnectConfigs.appId, appId)).limit(1);

  if (!config) {
    return { error: 'Add App Store Connect credentials first.' };
  }

  const creds = {
    issuerId: config.issuerId,
    keyId: config.keyId,
    privateKeyPem: decryptSecret(config.privateKeyEncrypted),
    vendorNumber: config.vendorNumber,
    ascAppId: config.ascAppId
  };

  const now = new Date();
  const thisWeek = mondayOf(now);
  const lastWeekStart = new Date(now);

  lastWeekStart.setUTCDate(now.getUTCDate() - 7);
  const lastWeek = mondayOf(lastWeekStart);

  try {
    for (const weekStart of [lastWeek, thisWeek]) {
      const downloads = await fetchWeeklyDownloads(creds, weekStart);

      await db
        .insert(appFunnelMetrics)
        .values({ appId, periodStart: weekStart, appStoreDownloads: downloads })
        .onConflictDoUpdate({
          target: [appFunnelMetrics.appId, appFunnelMetrics.periodStart],
          set: { appStoreDownloads: downloads, updatedAt: new Date() }
        });
    }

    await db.update(appStoreConnectConfigs).set({ lastSyncedAt: new Date(), lastSyncError: null }).where(eq(appStoreConnectConfigs.id, config.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed.';

    await db.update(appStoreConnectConfigs).set({ lastSyncError: message }).where(eq(appStoreConnectConfigs.id, config.id));

    return { error: message };
  }

  const slug = await slugFor(appId);

  if (slug) {
    revalidatePath(`/internal/metrics/${slug}`);
  }

  revalidatePath('/internal/metrics');

  return { synced: thisWeek };
}
