import 'server-only';

import { randomUUID } from 'node:crypto';
import { sql, type SQL } from 'drizzle-orm';

import { db } from '@/server/db/client';
import { leaseFence, type LeaseHolder } from '@/server/pipeline/lease';
import { rowsOf } from '@/server/pipeline/queue';
import { openSecret, sealSecret, secretHint } from '@/server/vault/crypto';

// RevenueCat API access for a build's monetization stage.
//
// Two kinds of `revenuecat` account:
//
//   oauth_client  {clientId, clientSecret?, refreshToken, accessToken?, expiresAt?}
//                 A RevenueCat OAuth app (granted once by RevenueCat support). Can create
//                 projects, so every app gets its own project with no human step. Access
//                 tokens last an hour; refresh tokens ROTATE — each one works exactly once.
//   access_token  `sk_…`, a project secret key a human pasted for ONE app. Labelled with the
//                 app's slug, identity = the RevenueCat project id. The fallback until the
//                 OAuth client exists, and an override for an app that must live in a
//                 particular project.
//
// The orchestrator never sees a refresh token: it asks here for an access token and gets one.
//
// Single-use refresh without transactions. neon-http has no interactive transactions, so
// the refresh is guarded by a compare-and-swap lock in the account's `quota` jsonb
// (`refreshLock`, `refreshLockUntil`): ONE statement takes the lock if it is free or stale,
// the holder calls RevenueCat and stores the rotated pair, everyone else waits for the new
// access token to appear. Two machines therefore never spend the same refresh token. The lock
// outlives the HTTP timeout, so a holder cannot lose it mid-call.

type Row = Record<string, unknown>;

const execute = async (query: SQL): Promise<Row[]> => rowsOf(await db.execute(query));

export type RevenueCatToken = {
  accessToken: string;
  mode: 'oauth' | 'project';
  projectId: string | null;
  accountId: string;
  label: string;
};

export type OAuthClientSecret = {
  clientId: string;
  clientSecret?: string;
  refreshToken: string;
  accessToken?: string;
  // ISO time the access token stops working.
  expiresAt?: string;
};

export class RevenueCatTokenError extends Error {
  constructor(message: string, readonly status: number = 502) {
    super(message);
  }
}

const TOKEN_URL = () => process.env.REVENUECAT_OAUTH_TOKEN_URL || 'https://api.revenuecat.com/oauth2/token';
const FETCH_TIMEOUT_MS = 20_000;
const LOCK_SECONDS = 45;
// A token with less than this left is refreshed rather than handed out: a monetization stage
// makes a few dozen calls, and RevenueCat rejects an expired token mid-stage.
const MIN_REMAINING_MS = 10 * 60_000;
const WAIT_MS = 30_000;

export function parseOAuthClientSecret(plaintext: string): OAuthClientSecret {
  let value: unknown;
  try {
    value = JSON.parse(plaintext);
  } catch {
    throw new RevenueCatTokenError('The RevenueCat OAuth account is not JSON {clientId, clientSecret, refreshToken}.', 500);
  }
  const secret = value as Partial<OAuthClientSecret>;
  if (!secret || typeof secret.clientId !== 'string' || typeof secret.refreshToken !== 'string') {
    throw new RevenueCatTokenError('The RevenueCat OAuth account needs clientId and refreshToken.', 500);
  }
  return secret as OAuthClientSecret;
}

function fresh(secret: OAuthClientSecret, now: number): boolean {
  return Boolean(secret.accessToken && secret.expiresAt && Date.parse(secret.expiresAt) - now > MIN_REMAINING_MS);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Candidate = { id: string; label: string; identity: string | null; credentialType: string; secretEncrypted: string; perApp: boolean };

/**
 * The run's RevenueCat token, or null when the pool has none that applies.
 * `runValid: false` = the caller's run lease is gone (409 for the route).
 */
export async function revenuecatTokenForRun(input: {
  runId: string;
  holder: LeaseHolder;
  fetchImpl?: typeof fetch;
}): Promise<{ runValid: false } | { runValid: true; token: RevenueCatToken | null }> {
  // The per-app key is matched against every name the app goes by: the bet slug, its public
  // slug, and the brand slug of its product.
  const rows = await execute(sql`
    WITH run AS (
      SELECT r.id, r.bet_id FROM pipeline_runs r WHERE r.id = ${input.runId} AND ${leaseFence(input.holder, 'r')}
    ),
    slugs AS (
      SELECT lower(b.slug) AS slug FROM bets b JOIN run ON b.id = run.bet_id
      UNION SELECT lower(b.public_slug) FROM bets b JOIN run ON b.id = run.bet_id WHERE b.public_slug IS NOT NULL
      UNION SELECT lower(p.slug) FROM products p JOIN run ON p.bet_id = run.bet_id
    )
    SELECT run.id AS run_id, a.id, a.label, a.identity, a.credential_type, a.secret_encrypted,
      (a.credential_type = 'access_token') AS per_app
    FROM run
    LEFT JOIN provider_accounts a
      ON a.provider = 'revenuecat' AND a.status = 'active'
      AND (a.credential_type = 'oauth_client'
           OR (a.credential_type = 'access_token' AND lower(a.label) IN (SELECT slug FROM slugs)))
    ORDER BY per_app DESC NULLS LAST, a.last_used_at ASC NULLS FIRST, a.created_at
  `);

  if (rows.length === 0) return { runValid: false };
  const candidates: Candidate[] = rows
    .filter((row) => row.id)
    .map((row) => ({
      id: String(row.id),
      label: String(row.label),
      identity: row.identity ? String(row.identity) : null,
      credentialType: String(row.credential_type),
      secretEncrypted: String(row.secret_encrypted),
      perApp: Boolean(row.per_app)
    }));
  const chosen = candidates[0];
  if (!chosen) return { runValid: true, token: null };

  await execute(sql`UPDATE provider_accounts SET last_used_at = now() WHERE id = ${chosen.id}`);

  if (chosen.perApp) {
    return {
      runValid: true,
      token: { accessToken: openSecret(chosen.secretEncrypted).trim(), mode: 'project', projectId: chosen.identity, accountId: chosen.id, label: chosen.label }
    };
  }
  const accessToken = await oauthAccessToken(chosen.id, chosen.secretEncrypted, input.fetchImpl ?? fetch);
  return { runValid: true, token: { accessToken, mode: 'oauth', projectId: null, accountId: chosen.id, label: chosen.label } };
}

/**
 * A token that can read one RevenueCat project, outside any run (the metrics cron): that
 * project's own key if a human pasted one, else the OAuth client. Null = none.
 */
export async function revenuecatTokenForProject(projectId: string, fetchImpl: typeof fetch = fetch): Promise<RevenueCatToken | null> {
  const rows = await execute(sql`
    SELECT id, label, identity, credential_type, secret_encrypted FROM provider_accounts
    WHERE provider = 'revenuecat' AND status = 'active'
      AND (credential_type = 'oauth_client' OR (credential_type = 'access_token' AND identity = ${projectId}))
    ORDER BY (credential_type = 'access_token') DESC, last_used_at ASC NULLS FIRST, created_at
    LIMIT 1
  `);
  const row = rows[0];
  if (!row) return null;
  const base = { accountId: String(row.id), label: String(row.label), projectId };
  if (row.credential_type === 'access_token') {
    return { ...base, accessToken: openSecret(String(row.secret_encrypted)).trim(), mode: 'project' };
  }
  return { ...base, accessToken: await oauthAccessToken(String(row.id), String(row.secret_encrypted), fetchImpl), mode: 'oauth' };
}

/** A valid access token for one oauth_client account, refreshing it at most once across all callers. */
export async function oauthAccessToken(accountId: string, secretEncrypted: string, fetchImpl: typeof fetch): Promise<string> {
  const current = parseOAuthClientSecret(openSecret(secretEncrypted));
  if (fresh(current, Date.now())) return current.accessToken!;

  const lockId = randomUUID();
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    const [locked] = await execute(sql`
      UPDATE provider_accounts
      SET quota = quota || jsonb_build_object('refreshLock', ${lockId}::text,
                                              'refreshLockUntil', (now() + make_interval(secs => ${LOCK_SECONDS}))::text),
          updated_at = now()
      WHERE id = ${accountId}
        AND (quota->>'refreshLockUntil' IS NULL OR (quota->>'refreshLockUntil')::timestamptz < now())
      RETURNING secret_encrypted
    `);

    if (locked) {
      // Re-read under the lock: another caller may have refreshed between our read and our lock.
      const latest = parseOAuthClientSecret(openSecret(String(locked.secret_encrypted)));
      if (fresh(latest, Date.now())) {
        await unlock(accountId, lockId);
        return latest.accessToken!;
      }
      let refreshed: OAuthClientSecret;
      try {
        refreshed = await refresh(latest, fetchImpl);
      } catch (error) {
        await unlock(accountId, lockId);
        throw error;
      }
      // Stored whatever happened to the lock: the rotated refresh token is the only valid one now.
      const plaintext = JSON.stringify(refreshed);
      await execute(sql`
        UPDATE provider_accounts
        SET secret_encrypted = ${sealSecret(plaintext)},
            secret_hint = ${secretHint(refreshed.refreshToken)},
            quota = CASE WHEN quota->>'refreshLock' = ${lockId} THEN quota - 'refreshLock' - 'refreshLockUntil' ELSE quota END,
            limited_until = NULL, limit_reason = NULL,
            updated_at = now()
        WHERE id = ${accountId}
      `);
      return refreshed.accessToken!;
    }

    // Someone else is refreshing: wait for their token.
    await sleep(250 + Math.random() * 250);
    const [row] = await execute(sql`SELECT secret_encrypted FROM provider_accounts WHERE id = ${accountId}`);
    if (!row) throw new RevenueCatTokenError('The RevenueCat account disappeared.', 500);
    const latest = parseOAuthClientSecret(openSecret(String(row.secret_encrypted)));
    if (fresh(latest, Date.now())) return latest.accessToken!;
  }
  throw new RevenueCatTokenError('Another machine is refreshing the RevenueCat token and has not finished; retry shortly.', 503);
}

async function unlock(accountId: string, lockId: string) {
  await execute(sql`
    UPDATE provider_accounts SET quota = quota - 'refreshLock' - 'refreshLockUntil'
    WHERE id = ${accountId} AND quota->>'refreshLock' = ${lockId}
  `);
}

async function refresh(secret: OAuthClientSecret, fetchImpl: typeof fetch): Promise<OAuthClientSecret> {
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: secret.refreshToken, client_id: secret.clientId });
  if (secret.clientSecret) body.set('client_secret', secret.clientSecret);

  let response: Response;
  try {
    response = await fetchImpl(TOKEN_URL(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
  } catch (error) {
    throw new RevenueCatTokenError(`RevenueCat token endpoint unreachable: ${error instanceof Error ? error.message : String(error)}`);
  }
  const text = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    // keep {} — reported below
  }
  if (!response.ok || typeof data.access_token !== 'string') {
    const reason = String(data.error_description ?? data.error ?? text.slice(0, 200) ?? response.status);
    if (data.error === 'invalid_grant') {
      throw new RevenueCatTokenError(`RevenueCat rejected the refresh token (${reason}). Re-authorise the OAuth client and update the account in Accounts.`, 502);
    }
    throw new RevenueCatTokenError(`RevenueCat token refresh failed: ${response.status} ${reason}`);
  }
  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600;
  return {
    ...secret,
    accessToken: data.access_token,
    refreshToken: typeof data.refresh_token === 'string' && data.refresh_token ? data.refresh_token : secret.refreshToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString()
  };
}
