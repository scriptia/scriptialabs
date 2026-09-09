import 'server-only';

import { and, desc, eq } from 'drizzle-orm';

import { db } from '@/server/db/client';
import { appFunnelMetrics, apps } from '@/server/db/schema';

// All apps plus their most recent funnel week, for the overview grid. An app
// with no entries yet still shows up — with a null latest week — so it's
// obvious data collection hasn't started rather than the app being missing.
export async function listAppsWithLatestFunnel() {
  const appRows = await db.select().from(apps).where(eq(apps.isActive, true)).orderBy(apps.name);
  const metricRows = await db.select().from(appFunnelMetrics).orderBy(desc(appFunnelMetrics.periodStart));

  const latestByApp = new Map<string, (typeof metricRows)[number]>();

  for (const row of metricRows) {
    if (!latestByApp.has(row.appId)) {
      latestByApp.set(row.appId, row);
    }
  }

  return appRows.map((app) => ({ app, latest: latestByApp.get(app.id) ?? null }));
}

export async function getAppBySlug(slug: string) {
  const [row] = await db.select().from(apps).where(eq(apps.slug, slug)).limit(1);

  return row ?? null;
}

// Newest-first week history for one app, for the detail page's table and
// trend chart.
export async function listFunnelEntries(appId: string) {
  return db.select().from(appFunnelMetrics).where(eq(appFunnelMetrics.appId, appId)).orderBy(desc(appFunnelMetrics.periodStart));
}

export async function getFunnelEntry(appId: string, periodStart: string) {
  const [row] = await db
    .select()
    .from(appFunnelMetrics)
    .where(and(eq(appFunnelMetrics.appId, appId), eq(appFunnelMetrics.periodStart, periodStart)))
    .limit(1);

  return row ?? null;
}

export type FunnelEntryRow = Awaited<ReturnType<typeof listFunnelEntries>>[number];
