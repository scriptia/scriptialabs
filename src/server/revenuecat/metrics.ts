import 'server-only';

import { isNotNull, sql } from 'drizzle-orm';

import { revenuecatTokenForProject } from '@/server/accounts/revenuecat';
import { db } from '@/server/db/client';
import { appDeployments, revenueSnapshots } from '@/server/db/schema';

// Daily RevenueCat numbers per app, for the bet page's Monetization card.
//
// One call per project: GET /v2/projects/{id}/metrics/overview, which returns RevenueCat's
// dashboard overview as [{id, name, value, unit, period}]. The headline ids are promoted to
// columns; every metric is kept in `raw` so a new one is never lost.

const API = () => (process.env.REVENUECAT_API_BASE || 'https://api.revenuecat.com/v2').replace(/\/$/, '');

type OverviewMetric = { id?: string; value?: number | string | null; unit?: string; period?: string };

export type SnapshotOutcome = { betId: string; projectId: string; ok: boolean; error?: string };

function num(metrics: Map<string, OverviewMetric>, id: string): number | null {
  const value = metrics.get(id)?.value;
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function fetchOverview(projectId: string, accessToken: string, fetchImpl: typeof fetch = fetch): Promise<OverviewMetric[]> {
  const response = await fetchImpl(`${API()}/projects/${encodeURIComponent(projectId)}/metrics/overview`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(20_000)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`RevenueCat metrics ${response.status}: ${text.slice(0, 200)}`);
  const data = (text ? JSON.parse(text) : {}) as { metrics?: OverviewMetric[] };
  return Array.isArray(data.metrics) ? data.metrics : [];
}

export function snapshotFrom(metrics: OverviewMetric[]) {
  const byId = new Map(metrics.filter((m) => m.id).map((m) => [String(m.id), m]));
  const decimal = (id: string) => {
    const n = num(byId, id);
    return n === null ? null : n.toFixed(2);
  };
  const integer = (id: string) => {
    const n = num(byId, id);
    return n === null ? null : Math.round(n);
  };
  return {
    mrr: decimal('mrr'),
    revenue28d: decimal('revenue'),
    activeSubscriptions: integer('active_subscriptions'),
    activeTrials: integer('active_trials'),
    newCustomers28d: integer('new_customers'),
    activeUsers28d: integer('active_users'),
    raw: Object.fromEntries([...byId].map(([id, m]) => [id, { value: m.value ?? null, unit: m.unit ?? null, period: m.period ?? null }]))
  };
}

/** Today's snapshot for every app with a RevenueCat project. Failures are per app, never fatal. */
export async function collectRevenueSnapshots(fetchImpl: typeof fetch = fetch): Promise<SnapshotOutcome[]> {
  const apps = await db
    .select({ betId: appDeployments.betId, projectId: appDeployments.revenuecatProjectId })
    .from(appDeployments)
    .where(isNotNull(appDeployments.revenuecatProjectId));

  const today = new Date().toISOString().slice(0, 10);
  const outcomes: SnapshotOutcome[] = [];
  for (const app of apps) {
    const projectId = app.projectId!;
    try {
      const token = await revenuecatTokenForProject(projectId, fetchImpl);
      if (!token) {
        outcomes.push({ betId: app.betId, projectId, ok: false, error: 'no RevenueCat account can read this project' });
        continue;
      }
      const snapshot = snapshotFrom(await fetchOverview(projectId, token.accessToken, fetchImpl));
      await db
        .insert(revenueSnapshots)
        .values({ betId: app.betId, date: today, ...snapshot })
        .onConflictDoUpdate({ target: [revenueSnapshots.betId, revenueSnapshots.date], set: { ...snapshot, createdAt: sql`now()` } });
      outcomes.push({ betId: app.betId, projectId, ok: true });
    } catch (error) {
      outcomes.push({ betId: app.betId, projectId, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return outcomes;
}
