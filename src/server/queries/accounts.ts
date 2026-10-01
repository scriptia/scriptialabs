import 'server-only';

import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';

import { accountAvailability, type AccountAvailability, type AccountProvider } from '@/content/internal';
import { db } from '@/server/db/client';
import { accountLeases, bets, pipelineRuns, providerAccounts } from '@/server/db/schema';

// Panel-side reads for the account pool. Never selects `secret_encrypted`:
// the panel can replace a secret, it can never read one back.

export type AccountView = {
  id: string;
  provider: AccountProvider;
  label: string;
  identity: string | null;
  credentialType: string;
  secretHint: string | null;
  plan: string | null;
  status: 'active' | 'disabled';
  maxConcurrency: number;
  activeLeases: number;
  limitedUntil: Date | null;
  limitReason: string | null;
  quota: Record<string, unknown>;
  lastUsedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  availability: AccountAvailability;
  // The runs holding it right now, for "In use by …".
  heldBy: Array<{ runId: string; betSlug: string | null; kind: string; purpose: string }>;
  // Sessions it served in the last 7 days, and how many ended on a limit.
  sessions7d: number;
  limits7d: number;
};

const viewSelection = {
  id: providerAccounts.id,
  provider: providerAccounts.provider,
  label: providerAccounts.label,
  identity: providerAccounts.identity,
  credentialType: providerAccounts.credentialType,
  secretHint: providerAccounts.secretHint,
  plan: providerAccounts.plan,
  status: providerAccounts.status,
  maxConcurrency: providerAccounts.maxConcurrency,
  activeLeases: providerAccounts.activeLeases,
  limitedUntil: providerAccounts.limitedUntil,
  limitReason: providerAccounts.limitReason,
  quota: providerAccounts.quota,
  lastUsedAt: providerAccounts.lastUsedAt,
  notes: providerAccounts.notes,
  createdAt: providerAccounts.createdAt,
  sessions7d: sql<number>`(select count(*)::int from run_sessions s where s.account_id = ${providerAccounts.id} and s.started_at > now() - interval '7 days')`,
  limits7d: sql<number>`(select count(*)::int from run_sessions s where s.account_id = ${providerAccounts.id} and s.end_reason = 'limit' and s.started_at > now() - interval '7 days')`
};

export async function listAccounts(provider?: AccountProvider): Promise<AccountView[]> {
  const rows = await db
    .select(viewSelection)
    .from(providerAccounts)
    .where(provider ? eq(providerAccounts.provider, provider) : undefined)
    .orderBy(asc(providerAccounts.provider), asc(providerAccounts.label));

  const leases = await db
    .select({ accountId: accountLeases.accountId, runId: accountLeases.runId, purpose: accountLeases.purpose, kind: pipelineRuns.kind, betSlug: bets.slug })
    .from(accountLeases)
    .leftJoin(pipelineRuns, eq(pipelineRuns.id, accountLeases.runId))
    .leftJoin(bets, eq(bets.id, pipelineRuns.betId))
    .where(isNull(accountLeases.releasedAt));

  const now = new Date();
  return rows.map((row) => ({
    ...row,
    availability: accountAvailability(row, now),
    heldBy: leases
      .filter((lease) => lease.accountId === row.id && lease.runId)
      .map((lease) => ({ runId: lease.runId as string, betSlug: lease.betSlug, kind: lease.kind ?? 'unknown', purpose: lease.purpose }))
  }));
}

export async function getAccount(id: string) {
  const [row] = await db.select(viewSelection).from(providerAccounts).where(eq(providerAccounts.id, id)).limit(1);
  return row ?? null;
}

/** Recent sessions on one account, for its detail drawer. */
export async function getAccountHistory(id: string, limit = 20) {
  return db.execute(sql`
    select s.id, s.seq, s.run_id, s.runner_id, s.started_at, s.ended_at, s.end_reason, r.kind, b.slug as bet_slug
    from run_sessions s
    join pipeline_runs r on r.id = s.run_id
    left join bets b on b.id = r.bet_id
    where s.account_id = ${id}
    order by s.started_at desc
    limit ${limit}
  `);
}

/** Counts per provider for the tab badges: total active, free right now. */
export async function countAccountsByProvider() {
  const rows = await db
    .select({
      provider: providerAccounts.provider,
      total: sql<number>`count(*)::int`,
      free: sql<number>`count(*) filter (where ${providerAccounts.status} = 'active' and (${providerAccounts.limitedUntil} is null or ${providerAccounts.limitedUntil} <= now()) and ${providerAccounts.activeLeases} < ${providerAccounts.maxConcurrency})::int`
    })
    .from(providerAccounts)
    .groupBy(providerAccounts.provider);

  return Object.fromEntries(rows.map((row) => [row.provider, { total: row.total, free: row.free }])) as Partial<Record<AccountProvider, { total: number; free: number }>>;
}

export async function findAccountByLabel(provider: AccountProvider, label: string) {
  const [row] = await db
    .select({ id: providerAccounts.id })
    .from(providerAccounts)
    .where(and(eq(providerAccounts.provider, provider), eq(providerAccounts.label, label)))
    .orderBy(desc(providerAccounts.createdAt))
    .limit(1);
  return row ?? null;
}
