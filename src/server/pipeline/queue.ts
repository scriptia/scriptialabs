import 'server-only';

import { sql, type SQL } from 'drizzle-orm';

import type { AccountProvider, PipelineRunKind } from '@/content/internal';
import { db } from '@/server/db/client';
import { leaseFence, type LeaseHolder } from './lease';

// The queue's state transitions, each ONE SQL statement.
//
// The neon-http driver has no interactive transactions (db/client.ts), so every
// transition that touches more than one row — a claim takes a run AND an
// account AND writes a lease AND a session — is a single statement built from
// data-modifying CTEs. Postgres runs the whole statement atomically: either the
// run was claimed with an account, a lease and a session row, or nothing
// happened. There is no state in which a run is claimed and its account is not.
//
// Races between machines are settled by row locks, not by reading first:
//
//   * `FOR UPDATE SKIP LOCKED` on the run and on the account — two claims at the
//     same instant take different rows instead of queueing on the same one.
//   * Every write a runner makes is fenced on its lease token (lease.ts), in the
//     same WHERE clause as the write.
//   * `provider_accounts.active_leases` is a column on the locked account row,
//     so Postgres' re-check of a locked row sees the other claim's increment.

type Row = Record<string, unknown>;

export function rowsOf(result: unknown): Row[] {
  const rows = (result as { rows?: Row[] }).rows ?? (result as Row[]);
  return Array.isArray(rows) ? rows : [];
}

async function execute(query: SQL): Promise<Row[]> {
  return rowsOf(await db.execute(query));
}

const json = (value: unknown) => (value === undefined || value === null ? null : JSON.stringify(value));

const isoOrNull = (value: Date | null | undefined) => (value ? value.toISOString() : null);

function asDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.valueOf()) ? null : date;
}

// Releases every unreleased account lease of the runs in `runs` (a CTE name
// returning `id`), decrements the accounts they held, and closes the open
// session. Shared by complete, pause and the reaper so the three can never
// disagree about what "letting go of a run" means.
//
// `limit` optionally marks ONE of the released accounts limited — in the same
// UPDATE as its decrement, because two CTEs updating the same row in one
// statement is not allowed (only one of the writes would land).
function releaseCtes(opts: {
  runsCte: string;
  endReason: string;
  usage?: unknown;
  limit?: { accountId: string; until: Date; reason: string } | null;
}): SQL {
  const runs = sql.raw(opts.runsCte);
  const limitId = opts.limit?.accountId ?? null;
  const limitUntil = isoOrNull(opts.limit?.until);
  const limitReason = opts.limit?.reason ?? null;

  return sql`
    rel AS (
      UPDATE account_leases l SET released_at = now()
      FROM ${runs} WHERE l.run_id = ${runs}.id AND l.released_at IS NULL
      RETURNING l.account_id
    ),
    acc AS (
      UPDATE provider_accounts a SET
        active_leases = GREATEST(a.active_leases - c.n, 0),
        limited_until = CASE WHEN a.id = ${limitId}::uuid THEN ${limitUntil}::timestamptz ELSE a.limited_until END,
        limit_reason = CASE WHEN a.id = ${limitId}::uuid THEN ${limitReason}::text ELSE a.limit_reason END,
        updated_at = now()
      FROM (SELECT account_id, count(*)::int AS n FROM rel GROUP BY account_id) c
      WHERE a.id = c.account_id
      RETURNING a.id, a.label, a.limited_until
    ),
    sess AS (
      UPDATE run_sessions s SET
        ended_at = now(),
        end_reason = ${opts.endReason},
        usage = COALESCE(${json(opts.usage)}::jsonb, s.usage)
      FROM ${runs} WHERE s.run_id = ${runs}.id AND s.ended_at IS NULL
      RETURNING s.id
    )`;
}

// ---------------------------------------------------------------------------
// Claim
// ---------------------------------------------------------------------------

export type ClaimedAccount = {
  id: string;
  label: string;
  identity: string | null;
  credentialType: string;
  secretEncrypted: string;
};

export type ClaimResult =
  | {
      claimed: true;
      runId: string;
      betId: string | null;
      kind: PipelineRunKind;
      leaseToken: string;
      sessionSeq: number;
      sessionId: string | null;
      previousStatus: string;
      account: ClaimedAccount | null;
    }
  | { claimed: false; reason: 'no_work' | 'no_accounts'; nextAccountAt: Date | null; nextRetryAt: Date | null };

const kindList = (kinds: readonly PipelineRunKind[]) =>
  sql.join(
    kinds.map((kind) => sql`${kind}`),
    sql`, `
  );

// The job-selection predicate shared by both claim paths and the idle
// diagnosis. The discovery clause is the one-in-flight rule: a discovery run
// is skipped while ANOTHER discovery run is past the queue. The partial unique
// index `pipeline_runs_one_discovery_in_flight` is the backstop for two claims
// racing past this check.
function claimableWhere(kinds: readonly PipelineRunKind[], statuses: SQL): SQL {
  return sql`r.status IN (${statuses})
      AND r.kind IN (${kindList(kinds)})
      AND (r.retry_after IS NULL OR r.retry_after <= now())
      AND r.cancel_requested_at IS NULL
      AND (r.bet_id IS NOT NULL OR NOT EXISTS (
        SELECT 1 FROM pipeline_runs d
        WHERE d.bet_id IS NULL AND d.id <> r.id AND d.status IN ('claimed', 'running', 'paused')
      ))`;
}

/**
 * Claims the next run WITH a Claude account from the pool, atomically.
 *
 * Order: priority, then paused before queued (a paused run already has work
 * invested — finishing it frees its bet sooner), then runs this same runner
 * last held (its workspace is still on this disk, so no checkpoint download),
 * then oldest first.
 *
 * No free account = no claim, even if work is waiting. The caller reports that
 * as `no_accounts` so the machine sleeps until the earliest reset instead of
 * polling a closed window.
 */
export async function claimWithAccount(input: { runnerId: string; kinds: readonly PipelineRunKind[]; leaseSeconds: number }): Promise<ClaimResult> {
  const { runnerId, kinds, leaseSeconds } = input;

  const rows = await execute(sql`
    WITH job AS (
      SELECT r.id, r.status AS prev_status
      FROM pipeline_runs r
      WHERE ${claimableWhere(kinds, sql`'queued', 'paused'`)}
      ORDER BY r.priority DESC, (r.status = 'paused') DESC, (r.runner_id IS NOT DISTINCT FROM ${runnerId}) DESC, r.queued_at
      LIMIT 1
      FOR UPDATE OF r SKIP LOCKED
    ),
    acct AS (
      SELECT a.id, a.label, a.identity, a.credential_type, a.secret_encrypted
      FROM provider_accounts a
      WHERE a.provider = 'claude'
        AND a.status = 'active'
        AND (a.limited_until IS NULL OR a.limited_until <= now())
        AND a.active_leases < a.max_concurrency
        AND EXISTS (SELECT 1 FROM job)
      ORDER BY a.last_used_at ASC NULLS FIRST, a.created_at
      LIMIT 1
      FOR UPDATE OF a SKIP LOCKED
    ),
    upd AS (
      UPDATE pipeline_runs r SET
        status = 'claimed',
        runner_id = ${runnerId},
        lease_token = gen_random_uuid(),
        session_count = r.session_count + 1,
        claimed_at = now(),
        heartbeat_at = now(),
        lease_expires_at = now() + make_interval(secs => ${leaseSeconds}),
        retry_after = NULL,
        updated_at = now()
      FROM job, acct
      WHERE r.id = job.id
      RETURNING r.id, r.bet_id, r.kind, r.lease_token, r.session_count, r.lease_expires_at, job.prev_status
    ),
    touch AS (
      UPDATE provider_accounts a SET active_leases = a.active_leases + 1, last_used_at = now(), updated_at = now()
      FROM upd, acct
      WHERE a.id = acct.id
      RETURNING a.id
    ),
    lease AS (
      INSERT INTO account_leases (account_id, run_id, runner_id, lease_token, purpose, expires_at)
      SELECT acct.id, upd.id, ${runnerId}, upd.lease_token, 'session', upd.lease_expires_at FROM upd, acct
      RETURNING id
    ),
    sess AS (
      INSERT INTO run_sessions (run_id, seq, account_id, runner_id)
      SELECT upd.id, upd.session_count, acct.id, ${runnerId} FROM upd, acct
      ON CONFLICT (run_id, seq) DO UPDATE SET account_id = EXCLUDED.account_id, runner_id = EXCLUDED.runner_id, started_at = now(), ended_at = NULL, end_reason = NULL
      RETURNING id
    )
    SELECT upd.id, upd.bet_id, upd.kind, upd.lease_token, upd.session_count, upd.prev_status,
      acct.id AS account_id, acct.label AS account_label, acct.identity AS account_identity,
      acct.credential_type, acct.secret_encrypted,
      (SELECT id FROM sess LIMIT 1) AS session_id,
      (SELECT count(*) FROM touch) AS touched,
      (SELECT count(*) FROM lease) AS leased
    FROM upd, acct
  `);

  const row = rows[0];
  if (!row) return diagnoseIdle(kinds);

  return {
    claimed: true,
    runId: String(row.id),
    betId: row.bet_id ? String(row.bet_id) : null,
    kind: String(row.kind) as PipelineRunKind,
    leaseToken: String(row.lease_token),
    sessionSeq: Number(row.session_count),
    sessionId: row.session_id ? String(row.session_id) : null,
    previousStatus: String(row.prev_status),
    account: {
      id: String(row.account_id),
      label: String(row.account_label),
      identity: row.account_identity ? String(row.account_identity) : null,
      credentialType: String(row.credential_type),
      secretEncrypted: String(row.secret_encrypted)
    }
  };
}

/**
 * The old claim, for runners that predate the pool (product-agent's and
 * builder-agent's runner.py). They use the machine's own Claude login, so no
 * account is leased, and they only understand `queued` runs — a paused run has
 * a checkpoint they cannot restore. Kept until both are retired; it still gets
 * a lease token so the fence is uniform.
 */
export async function claimLegacy(input: { runnerId: string; kinds: readonly PipelineRunKind[]; leaseSeconds: number }): Promise<ClaimResult> {
  const { runnerId, kinds, leaseSeconds } = input;

  const rows = await execute(sql`
    WITH job AS (
      SELECT r.id, r.status AS prev_status
      FROM pipeline_runs r
      WHERE ${claimableWhere(kinds, sql`'queued'`)}
      ORDER BY r.priority DESC, r.queued_at
      LIMIT 1
      FOR UPDATE OF r SKIP LOCKED
    ),
    upd AS (
      UPDATE pipeline_runs r SET
        status = 'claimed',
        runner_id = ${runnerId},
        lease_token = gen_random_uuid(),
        session_count = r.session_count + 1,
        claimed_at = now(),
        heartbeat_at = now(),
        lease_expires_at = now() + make_interval(secs => ${leaseSeconds}),
        updated_at = now()
      FROM job
      WHERE r.id = job.id
      RETURNING r.id, r.bet_id, r.kind, r.lease_token, r.session_count, job.prev_status
    ),
    sess AS (
      INSERT INTO run_sessions (run_id, seq, account_id, runner_id)
      SELECT upd.id, upd.session_count, NULL, ${runnerId} FROM upd
      ON CONFLICT (run_id, seq) DO NOTHING
      RETURNING id
    )
    SELECT upd.*, (SELECT id FROM sess LIMIT 1) AS session_id FROM upd
  `);

  const row = rows[0];
  if (!row) return { claimed: false, reason: 'no_work', nextAccountAt: null, nextRetryAt: null };

  return {
    claimed: true,
    runId: String(row.id),
    betId: row.bet_id ? String(row.bet_id) : null,
    kind: String(row.kind) as PipelineRunKind,
    leaseToken: String(row.lease_token),
    sessionSeq: Number(row.session_count),
    sessionId: row.session_id ? String(row.session_id) : null,
    previousStatus: String(row.prev_status),
    account: null
  };
}

/** Why nothing was claimed: an empty queue, or work waiting on the pool. */
async function diagnoseIdle(kinds: readonly PipelineRunKind[]): Promise<ClaimResult> {
  const [row] = await execute(sql`
    SELECT
      (SELECT count(*)::int FROM pipeline_runs r WHERE ${claimableWhere(kinds, sql`'queued', 'paused'`)}) AS claimable,
      (SELECT count(*)::int FROM provider_accounts
        WHERE provider = 'claude' AND status = 'active'
          AND (limited_until IS NULL OR limited_until <= now())
          AND active_leases < max_concurrency) AS free_accounts,
      (SELECT min(limited_until) FROM provider_accounts
        WHERE provider = 'claude' AND status = 'active' AND limited_until > now()) AS next_account_at,
      (SELECT min(retry_after) FROM pipeline_runs r
        WHERE r.status IN ('queued', 'paused') AND r.kind IN (${kindList(kinds)}) AND r.retry_after > now()) AS next_retry_at
  `);

  const claimable = Number(row?.claimable ?? 0);
  const freeAccounts = Number(row?.free_accounts ?? 0);

  return {
    claimed: false,
    reason: claimable > 0 && freeAccounts === 0 ? 'no_accounts' : 'no_work',
    nextAccountAt: asDate(row?.next_account_at),
    nextRetryAt: asDate(row?.next_retry_at)
  };
}

// ---------------------------------------------------------------------------
// Heartbeat
// ---------------------------------------------------------------------------

export type HeartbeatResult = { status: string; leaseExpiresAt: Date; cancelRequested: boolean; accountLeases: number };

/**
 * Extends the run lease AND every account lease taken under it, and merges
 * progress. The first heartbeat naming a stage turns `claimed` into `running`.
 * Returns null when the fence matched nothing — the caller answers 409.
 */
export async function heartbeatRun(input: {
  runId: string;
  holder: LeaseHolder;
  leaseSeconds: number;
  stage?: string;
  progress: Record<string, unknown>;
  externalRunId?: string;
}): Promise<HeartbeatResult | null> {
  const { runId, holder, leaseSeconds, progress } = input;
  const stage = input.stage ?? null;

  const rows = await execute(sql`
    WITH hb AS (
      UPDATE pipeline_runs SET
        status = CASE WHEN status = 'claimed' AND ${stage}::text IS NOT NULL THEN 'running' ELSE status END,
        started_at = CASE WHEN started_at IS NULL AND ${stage}::text IS NOT NULL THEN now() ELSE started_at END,
        progress = progress || ${JSON.stringify(progress)}::jsonb,
        heartbeat_at = now(),
        lease_expires_at = now() + make_interval(secs => ${leaseSeconds}),
        external_run_id = COALESCE(${input.externalRunId ?? null}::text, external_run_id),
        updated_at = now()
      WHERE id = ${runId} AND ${leaseFence(holder)}
      RETURNING id, status, lease_expires_at, cancel_requested_at, lease_token
    ),
    ext AS (
      UPDATE account_leases l SET expires_at = hb.lease_expires_at
      FROM hb
      WHERE l.run_id = hb.id AND l.lease_token = hb.lease_token AND l.released_at IS NULL
      RETURNING l.id
    )
    SELECT hb.status, hb.lease_expires_at, hb.cancel_requested_at, (SELECT count(*)::int FROM ext) AS account_leases FROM hb
  `);

  const row = rows[0];
  if (!row) return null;

  return {
    status: String(row.status),
    leaseExpiresAt: asDate(row.lease_expires_at) ?? new Date(),
    cancelRequested: Boolean(row.cancel_requested_at),
    accountLeases: Number(row.account_leases ?? 0)
  };
}

// ---------------------------------------------------------------------------
// Complete / pause
// ---------------------------------------------------------------------------

export type FinishStatus = 'succeeded' | 'failed' | 'cancelled';

const endReasonFor: Record<FinishStatus, string> = { succeeded: 'completed', failed: 'failed', cancelled: 'cancelled' };

/** Terminal outcome. Releases every account and closes the session, fenced. */
export async function finishRun(input: {
  runId: string;
  holder: LeaseHolder;
  status: FinishStatus;
  error?: string | null;
  result?: Record<string, unknown> | null;
  externalRunId?: string | null;
  logUrl?: string | null;
  usage?: Record<string, unknown> | null;
}): Promise<{ status: string; released: number } | null> {
  const rows = await execute(sql`
    WITH done AS (
      UPDATE pipeline_runs SET
        status = ${input.status},
        error = ${input.error ?? null}::text,
        result = ${json(input.result)}::jsonb,
        finished_at = now(),
        lease_expires_at = NULL,
        lease_token = NULL,
        blocked_reason = NULL,
        external_run_id = COALESCE(${input.externalRunId ?? null}::text, external_run_id),
        log_url = COALESCE(${input.logUrl ?? null}::text, log_url),
        updated_at = now()
      WHERE id = ${input.runId} AND ${leaseFence(input.holder)}
      RETURNING id, status
    ),
    ${releaseCtes({ runsCte: 'done', endReason: endReasonFor[input.status], usage: input.usage })}
    SELECT done.status, (SELECT count(*)::int FROM acc) AS released FROM done
  `);

  const row = rows[0];
  return row ? { status: String(row.status), released: Number(row.released ?? 0) } : null;
}

/**
 * A session ended on a limit. The run goes to `paused` with its checkpoint, the
 * account that ran out is marked limited until its reset, every lease is let
 * go, the session is closed — one statement.
 *
 * `runner_id` is deliberately KEPT: the claim query prefers handing a paused
 * run back to the machine that paused it, whose workspace is still warm.
 *
 * `resumeAfter` is for limits the pool cannot route around (no EAS account has
 * builds left): the run is not claimable before it. A Claude limit leaves it
 * null — the next claim with a free account continues immediately.
 */
export async function pauseRun(input: {
  runId: string;
  holder: LeaseHolder;
  reason: string;
  limitedAccount?: { accountId: string; until: Date } | null;
  resumeAfter?: Date | null;
  checkpoint?: Record<string, unknown> | null;
  progress?: Record<string, unknown>;
  usage?: Record<string, unknown> | null;
  // 'queued' only for a legacy runner reporting `blocked`: it cannot restore a
  // checkpoint, and the legacy claim only takes queued runs.
  asStatus?: 'paused' | 'queued';
}): Promise<{ sessionCount: number; limitedLabel: string | null; limitedUntil: Date | null } | null> {
  const limit = input.limitedAccount ? { accountId: input.limitedAccount.accountId, until: input.limitedAccount.until, reason: input.reason } : null;

  const rows = await execute(sql`
    WITH paused AS (
      UPDATE pipeline_runs SET
        status = ${input.asStatus ?? 'paused'},
        lease_token = NULL,
        lease_expires_at = NULL,
        claimed_at = NULL,
        retry_after = ${isoOrNull(input.resumeAfter)}::timestamptz,
        blocked_reason = ${input.reason},
        checkpoint = COALESCE(${json(input.checkpoint)}::jsonb, checkpoint),
        progress = progress || ${JSON.stringify(input.progress ?? {})}::jsonb,
        updated_at = now()
      WHERE id = ${input.runId} AND ${leaseFence(input.holder)}
      RETURNING id, session_count
    ),
    ${releaseCtes({ runsCte: 'paused', endReason: 'limit', usage: input.usage, limit })}
    SELECT paused.session_count,
      (SELECT label FROM acc WHERE id = ${limit?.accountId ?? null}::uuid) AS limited_label,
      (SELECT limited_until FROM acc WHERE id = ${limit?.accountId ?? null}::uuid) AS limited_until
    FROM paused
  `);

  const row = rows[0];
  if (!row) return null;

  return {
    sessionCount: Number(row.session_count),
    limitedLabel: row.limited_label ? String(row.limited_label) : null,
    limitedUntil: asDate(row.limited_until)
  };
}

/** Stores a checkpoint mid-session (before a risky step), fenced. */
export async function recordCheckpoint(input: { runId: string; holder: LeaseHolder; checkpoint: Record<string, unknown> }): Promise<boolean> {
  const rows = await execute(sql`
    UPDATE pipeline_runs SET checkpoint = ${JSON.stringify(input.checkpoint)}::jsonb, updated_at = now()
    WHERE id = ${input.runId} AND ${leaseFence(input.holder)}
    RETURNING id
  `);
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Platform-stage account leases (EAS, Supabase, Apple)
// ---------------------------------------------------------------------------

export type LeasedAccount = ClaimedAccount & { provider: AccountProvider; quota: Record<string, unknown>; plan: string | null };

/**
 * Leases one account of `provider` for a run that holds a valid lease. Same
 * locking as the claim. `prefer` wins when it is available (the EAS account an
 * app is already linked to — switching costs a version bump), and `exclude`
 * skips accounts this stage already found exhausted.
 */
export async function leaseAccount(input: {
  runId: string;
  holder: LeaseHolder;
  provider: AccountProvider;
  prefer?: string | null;
  exclude?: readonly string[];
}): Promise<{ account: LeasedAccount } | { account: null; runValid: boolean; nextAt: Date | null }> {
  const { runId, holder, provider } = input;
  const exclude = (input.exclude ?? []).join(',');

  const rows = await execute(sql`
    WITH run AS (
      SELECT r.id, r.lease_token, r.lease_expires_at FROM pipeline_runs r
      WHERE r.id = ${runId} AND ${leaseFence(holder, 'r')}
    ),
    acct AS (
      SELECT a.id, a.label, a.identity, a.credential_type, a.secret_encrypted, a.quota, a.plan
      FROM provider_accounts a
      WHERE a.provider = ${provider}
        AND a.status = 'active'
        AND (a.limited_until IS NULL OR a.limited_until <= now())
        AND a.active_leases < a.max_concurrency
        AND NOT (a.id::text = ANY(string_to_array(${exclude}, ',')))
        AND EXISTS (SELECT 1 FROM run)
      ORDER BY (a.id = ${input.prefer ?? null}::uuid) DESC NULLS LAST, a.last_used_at ASC NULLS FIRST, a.created_at
      LIMIT 1
      FOR UPDATE OF a SKIP LOCKED
    ),
    touch AS (
      UPDATE provider_accounts a SET active_leases = a.active_leases + 1, last_used_at = now(), updated_at = now()
      FROM acct WHERE a.id = acct.id
      RETURNING a.id
    ),
    lease AS (
      INSERT INTO account_leases (account_id, run_id, runner_id, lease_token, purpose, expires_at)
      SELECT acct.id, run.id, ${holder.runnerId}, run.lease_token, ${provider}, run.lease_expires_at FROM acct, run
      RETURNING id
    )
    SELECT acct.*, (SELECT count(*)::int FROM run) AS run_valid, (SELECT count(*) FROM touch) AS touched, (SELECT count(*) FROM lease) AS leased
    FROM acct
  `);

  const row = rows[0];
  if (row) {
    return {
      account: {
        id: String(row.id),
        label: String(row.label),
        identity: row.identity ? String(row.identity) : null,
        credentialType: String(row.credential_type),
        secretEncrypted: String(row.secret_encrypted),
        provider,
        quota: (row.quota as Record<string, unknown>) ?? {},
        plan: row.plan ? String(row.plan) : null
      }
    };
  }

  const [state] = await execute(sql`
    SELECT
      (SELECT count(*)::int FROM pipeline_runs r WHERE r.id = ${runId} AND ${leaseFence(holder, 'r')}) AS run_valid,
      (SELECT min(limited_until) FROM provider_accounts WHERE provider = ${provider} AND status = 'active' AND limited_until > now()) AS next_at
  `);

  return { account: null, runValid: Number(state?.run_valid ?? 0) > 0, nextAt: asDate(state?.next_at) };
}

/**
 * One account's secret for a run holding a valid lease, without leasing it: no slot taken,
 * limits ignored. For reading state an account already created (an EAS build it started),
 * never for starting new work on it — that is what leaseAccount is for.
 */
export async function peekAccount(input: { runId: string; holder: LeaseHolder; provider: AccountProvider; accountId: string }): Promise<LeasedAccount | null> {
  const rows = await execute(sql`
    SELECT a.id, a.label, a.identity, a.credential_type, a.secret_encrypted, a.quota, a.plan
    FROM provider_accounts a
    WHERE a.id = ${input.accountId} AND a.provider = ${input.provider} AND a.status = 'active'
      AND EXISTS (SELECT 1 FROM pipeline_runs r WHERE r.id = ${input.runId} AND ${leaseFence(input.holder, 'r')})
  `);

  const row = rows[0];
  if (!row) return null;

  return {
    id: String(row.id),
    label: String(row.label),
    identity: row.identity ? String(row.identity) : null,
    credentialType: String(row.credential_type),
    secretEncrypted: String(row.secret_encrypted),
    provider: input.provider,
    quota: (row.quota as Record<string, unknown>) ?? {},
    plan: row.plan ? String(row.plan) : null
  };
}

/**
 * Lets go of one platform-stage account before the run ends, optionally
 * marking it limited (EAS out of builds until the cycle resets) and merging
 * quota numbers. Fenced on the lease token the account was taken under.
 */
export async function releaseAccount(input: {
  accountId: string;
  runId: string;
  holder: LeaseHolder;
  limitedUntil?: Date | null;
  reason?: string | null;
  quota?: Record<string, unknown> | null;
}): Promise<boolean> {
  const token = input.holder.leaseToken ?? null;

  const rows = await execute(sql`
    WITH rel AS (
      UPDATE account_leases SET released_at = now()
      WHERE account_id = ${input.accountId} AND run_id = ${input.runId}
        AND lease_token = ${token}::uuid AND released_at IS NULL
      RETURNING account_id
    ),
    acc AS (
      UPDATE provider_accounts a SET
        active_leases = GREATEST(a.active_leases - (SELECT count(*)::int FROM rel), 0),
        limited_until = COALESCE(${isoOrNull(input.limitedUntil)}::timestamptz, a.limited_until),
        limit_reason = CASE WHEN ${isoOrNull(input.limitedUntil)}::timestamptz IS NULL THEN a.limit_reason ELSE ${input.reason ?? 'limit reached'}::text END,
        quota = a.quota || COALESCE(${json(input.quota)}::jsonb, '{}'::jsonb),
        updated_at = now()
      WHERE a.id = ${input.accountId} AND EXISTS (SELECT 1 FROM rel)
      RETURNING a.id
    )
    SELECT count(*)::int AS released FROM acc
  `);

  return Number(rows[0]?.released ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Human stop
// ---------------------------------------------------------------------------

/**
 * The only thing a human does to a run after starting it.
 *
 * Not yet running (queued or paused): cancelled on the spot, in one statement
 * that also lets go of anything it held. Running: flagged; the orchestrator
 * sees `stop` on its next heartbeat (≤60 s), stops the agent and completes it as
 * cancelled. Returns the outcome so the action can word its message.
 */
export async function stopRun(runId: string): Promise<'cancelled' | 'requested' | 'finished' | 'missing'> {
  const rows = await execute(sql`
    WITH stopped AS (
      UPDATE pipeline_runs SET
        status = 'cancelled',
        cancel_requested_at = COALESCE(cancel_requested_at, now()),
        finished_at = now(),
        lease_token = NULL,
        lease_expires_at = NULL,
        updated_at = now()
      WHERE id = ${runId} AND status IN ('queued', 'paused')
      RETURNING id
    ),
    ${releaseCtes({ runsCte: 'stopped', endReason: 'cancelled' })},
    flagged AS (
      UPDATE pipeline_runs SET cancel_requested_at = COALESCE(cancel_requested_at, now()), updated_at = now()
      WHERE id = ${runId} AND status IN ('claimed', 'running')
      RETURNING id
    )
    SELECT
      (SELECT count(*)::int FROM stopped) AS stopped,
      (SELECT count(*)::int FROM flagged) AS flagged,
      (SELECT status FROM pipeline_runs WHERE id = ${runId}) AS status
  `);

  const row = rows[0];
  if (!row || row.status === null || row.status === undefined) return 'missing';
  if (Number(row.stopped) > 0) return 'cancelled';
  if (Number(row.flagged) > 0) return 'requested';
  return 'finished';
}

// ---------------------------------------------------------------------------
// Reaper
// ---------------------------------------------------------------------------

export type ReapOutcome = 'cancelled' | 'expired' | 'paused' | 'queued';

/**
 * Takes back ONE run whose lease lapsed, if it is still lapsed at the moment of
 * the write. Conditional on status and expiry inside the UPDATE, so a heartbeat
 * that lands first simply wins and this matches nothing.
 *
 *   cancel requested      → cancelled (a stop must survive a dead runner)
 *   3rd lapsed lease      → expired
 *   has a checkpoint      → paused (resume from it, any machine)
 *   otherwise             → queued
 */
export async function reapRun(input: { runId: string; next: ReapOutcome; message: string }): Promise<boolean> {
  const terminal = input.next === 'cancelled' || input.next === 'expired';

  const rows = await execute(sql`
    WITH reaped AS (
      UPDATE pipeline_runs SET
        status = ${input.next},
        attempt = attempt + 1,
        lease_token = NULL,
        lease_expires_at = NULL,
        claimed_at = NULL,
        finished_at = CASE WHEN ${terminal}::boolean THEN now() ELSE NULL END,
        error = CASE WHEN ${input.next}::text = 'expired' THEN ${input.message}::text ELSE error END,
        blocked_reason = CASE WHEN ${input.next}::text = 'paused' THEN ${input.message}::text ELSE blocked_reason END,
        updated_at = now()
      WHERE id = ${input.runId} AND status IN ('claimed', 'running') AND lease_expires_at < now()
      RETURNING id
    ),
    ${releaseCtes({ runsCte: 'reaped', endReason: 'lease_lost' })}
    SELECT count(*)::int AS reaped FROM reaped
  `);

  return Number(rows[0]?.reaped ?? 0) > 0;
}

/**
 * Account leases that outlived their run's lease (a platform-stage lease whose
 * run was already reaped, a crash between two statements of a future code
 * path). One minute of grace past expiry so a heartbeat in flight always wins.
 */
export async function releaseExpiredAccountLeases(): Promise<number> {
  const rows = await execute(sql`
    WITH rel AS (
      UPDATE account_leases l SET released_at = now()
      WHERE l.released_at IS NULL AND l.expires_at < now() - interval '1 minute'
      RETURNING l.account_id
    ),
    acc AS (
      UPDATE provider_accounts a SET active_leases = GREATEST(a.active_leases - c.n, 0), updated_at = now()
      FROM (SELECT account_id, count(*)::int AS n FROM rel GROUP BY account_id) c
      WHERE a.id = c.account_id
      RETURNING a.id
    )
    SELECT (SELECT count(*)::int FROM rel) AS released
  `);

  return Number(rows[0]?.released ?? 0);
}

/**
 * Undoes a claim that cannot be served (the descriptor could not be built, the
 * vault could not open the account's secret). Back to the status it came from,
 * the session count restored, every lease let go — fenced on the token the
 * claim just issued, so it can only undo that exact claim.
 */
export async function unclaimRun(input: { runId: string; holder: LeaseHolder; previousStatus: string }): Promise<boolean> {
  const rows = await execute(sql`
    WITH undone AS (
      UPDATE pipeline_runs SET
        status = ${input.previousStatus === 'paused' ? 'paused' : 'queued'},
        session_count = GREATEST(session_count - 1, 0),
        lease_token = NULL,
        lease_expires_at = NULL,
        claimed_at = NULL,
        updated_at = now()
      WHERE id = ${input.runId} AND ${leaseFence(input.holder)}
      RETURNING id
    ),
    ${releaseCtes({ runsCte: 'undone', endReason: 'released' })}
    SELECT count(*)::int AS undone FROM undone
  `);

  return Number(rows[0]?.undone ?? 0) > 0;
}
