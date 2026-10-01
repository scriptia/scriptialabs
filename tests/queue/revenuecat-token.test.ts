// The RevenueCat token endpoint's refresh, against a real Postgres (same harness as queue.test.ts).
//
// RevenueCat refresh tokens are single-use: spending one twice kills the OAuth grant and every
// build after it. So the property under test is "N parallel callers, ONE refresh", plus the
// per-app key precedence and the lease fence.
//
//   TEST_DATABASE_URL=postgres://localhost/idion_test npx tsx --conditions=react-server \
//     --tsconfig tests/queue/tsconfig.json tests/queue/revenuecat-token.test.ts
import assert from 'node:assert/strict';

process.env.ACCOUNT_VAULT_KEY ??= 'test-vault-key-test-vault-key-test-vault-key';

const { pool } = await import('./db');
const { claimWithAccount } = await import('@/server/pipeline/queue');
const { revenuecatTokenForRun, RevenueCatTokenError } = await import('@/server/accounts/revenuecat');
const { openSecret, sealSecret } = await import('@/server/vault/crypto');

const q = async (text: string, params: unknown[] = []) => (await pool.query(text, params)).rows;

async function reset() {
  await q('TRUNCATE run_sessions, account_leases, provider_accounts, pipeline_run_events, pipeline_runs, products, bets CASCADE');
}

/** A claimed build run for a bet, and the holder that may act for it. */
async function claimedRun(slug: string) {
  const [bet] = await q(`INSERT INTO bets (slug, title) VALUES ($1, $1) RETURNING id`, [slug]);
  await q(`INSERT INTO pipeline_runs (kind, bet_id) VALUES ('build', $1)`, [bet.id]);
  await q(`INSERT INTO provider_accounts (provider, label, credential_type, secret_encrypted) VALUES ('claude', 'max', 'oauth_token', 'x:y:z')`);
  const claim = await claimWithAccount({ runnerId: 'm1', kinds: ['build'], leaseSeconds: 900 });
  assert.ok(claim.claimed);
  return { runId: claim.runId, holder: { runnerId: 'm1', leaseToken: claim.leaseToken } };
}

async function rcAccount(label: string, credentialType: string, secret: string, identity: string | null = null, quota = {}) {
  const [row] = await q(
    `INSERT INTO provider_accounts (provider, label, identity, credential_type, secret_encrypted, max_concurrency, quota)
     VALUES ('revenuecat', $1, $2, $3, $4, 100, $5) RETURNING id`,
    [label, identity, credentialType, sealSecret(secret), JSON.stringify(quota)]
  );
  return row.id as string;
}

/** RevenueCat's token endpoint, with single-use refresh tokens. */
function fakeRevenueCat(firstRefreshToken: string) {
  let valid = firstRefreshToken;
  let n = 0;
  const calls: string[] = [];
  const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = new URLSearchParams(String(init?.body));
    calls.push(body.get('refresh_token') ?? '');
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (body.get('refresh_token') !== valid) {
      return new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'refresh token already used' }), { status: 400 });
    }
    n += 1;
    valid = `rtk_${n}`;
    return new Response(JSON.stringify({ access_token: `atk_${n}`, refresh_token: valid, expires_in: 3600, token_type: 'Bearer' }), { status: 200 });
  }) as typeof fetch;
  return { fetchImpl, calls, current: () => valid };
}

const storedSecret = async (id: string) => {
  const [row] = await q(`SELECT secret_encrypted, quota FROM provider_accounts WHERE id = $1`, [id]);
  return { secret: JSON.parse(openSecret(row.secret_encrypted)), quota: row.quota as Record<string, unknown> };
};

let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  await reset();
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${name}`);
  } catch (error) {
    console.log(`FAIL ${name}`);
    throw error;
  }
}

await test('10 parallel callers with an expired token: exactly one refresh, everyone gets its token', async () => {
  const { runId, holder } = await claimedRun('hookio');
  const id = await rcAccount('oauth', 'oauth_client', JSON.stringify({ clientId: 'c', clientSecret: 's', refreshToken: 'rtk_0', accessToken: 'old', expiresAt: new Date(Date.now() - 1000).toISOString() }));
  const rc = fakeRevenueCat('rtk_0');
  const results = await Promise.all(Array.from({ length: 10 }, () => revenuecatTokenForRun({ runId, holder, fetchImpl: rc.fetchImpl })));
  assert.equal(rc.calls.length, 1, `refresh calls: ${rc.calls.join(', ')}`);
  for (const result of results) {
    assert.ok(result.runValid);
    assert.equal(result.token?.accessToken, 'atk_1');
    assert.equal(result.token?.mode, 'oauth');
  }
  const { secret, quota } = await storedSecret(id);
  assert.equal(secret.refreshToken, 'rtk_1', 'the rotated refresh token is stored');
  assert.equal(secret.clientSecret, 's');
  assert.equal(quota.refreshLock, undefined, 'the lock is released');
});

await test('a fresh token is handed out without touching RevenueCat', async () => {
  const { runId, holder } = await claimedRun('hookio');
  await rcAccount('oauth', 'oauth_client', JSON.stringify({ clientId: 'c', refreshToken: 'rtk_0', accessToken: 'atk_live', expiresAt: new Date(Date.now() + 3_000_000).toISOString() }));
  const rc = fakeRevenueCat('rtk_0');
  const result = await revenuecatTokenForRun({ runId, holder, fetchImpl: rc.fetchImpl });
  assert.ok(result.runValid && result.token);
  assert.equal(result.token.accessToken, 'atk_live');
  assert.equal(rc.calls.length, 0);
});

await test('a token with under 10 minutes left is refreshed', async () => {
  const { runId, holder } = await claimedRun('hookio');
  await rcAccount('oauth', 'oauth_client', JSON.stringify({ clientId: 'c', refreshToken: 'rtk_0', accessToken: 'atk_old', expiresAt: new Date(Date.now() + 120_000).toISOString() }));
  const rc = fakeRevenueCat('rtk_0');
  const result = await revenuecatTokenForRun({ runId, holder, fetchImpl: rc.fetchImpl });
  assert.ok(result.runValid && result.token);
  assert.equal(result.token.accessToken, 'atk_1');
});

await test('a per-app project key labelled with the app slug wins over the OAuth client', async () => {
  const { runId, holder } = await claimedRun('hookio');
  await rcAccount('oauth', 'oauth_client', JSON.stringify({ clientId: 'c', refreshToken: 'rtk_0' }));
  await rcAccount('other-app', 'access_token', 'sk_other', 'proj_other');
  await rcAccount('Hookio', 'access_token', 'sk_hookio', 'proj_hookio');
  const rc = fakeRevenueCat('rtk_0');
  const result = await revenuecatTokenForRun({ runId, holder, fetchImpl: rc.fetchImpl });
  assert.ok(result.runValid && result.token);
  assert.deepEqual([result.token.accessToken, result.token.mode, result.token.projectId], ['sk_hookio', 'project', 'proj_hookio']);
  assert.equal(rc.calls.length, 0);
});

await test("another app's per-app key is never handed out", async () => {
  const { runId, holder } = await claimedRun('hookio');
  await rcAccount('other-app', 'access_token', 'sk_other', 'proj_other');
  const result = await revenuecatTokenForRun({ runId, holder });
  assert.deepEqual(result, { runValid: true, token: null });
});

await test('a stale run lease gets nothing', async () => {
  const { runId } = await claimedRun('hookio');
  await rcAccount('Hookio', 'access_token', 'sk_hookio', 'proj_hookio');
  const result = await revenuecatTokenForRun({ runId, holder: { runnerId: 'm1', leaseToken: '00000000-0000-4000-8000-000000000000' } });
  assert.deepEqual(result, { runValid: false });
});

await test('a rejected refresh token fails loudly and releases the lock', async () => {
  const { runId, holder } = await claimedRun('hookio');
  const id = await rcAccount('oauth', 'oauth_client', JSON.stringify({ clientId: 'c', refreshToken: 'rtk_spent' }));
  const rc = fakeRevenueCat('rtk_other');
  await assert.rejects(revenuecatTokenForRun({ runId, holder, fetchImpl: rc.fetchImpl }), (error: unknown) =>
    error instanceof RevenueCatTokenError && /Re-authorise/.test(error.message));
  const { secret, quota } = await storedSecret(id);
  assert.equal(secret.refreshToken, 'rtk_spent', 'nothing overwritten');
  assert.equal(quota.refreshLock, undefined);
});

await test('a lock left by a crashed refresher is taken over once it is stale', async () => {
  const { runId, holder } = await claimedRun('hookio');
  await rcAccount('oauth', 'oauth_client', JSON.stringify({ clientId: 'c', refreshToken: 'rtk_0' }), null,
    { refreshLock: 'dead', refreshLockUntil: new Date(Date.now() - 1000).toISOString() });
  const rc = fakeRevenueCat('rtk_0');
  const result = await revenuecatTokenForRun({ runId, holder, fetchImpl: rc.fetchImpl });
  assert.ok(result.runValid && result.token);
  assert.equal(result.token.accessToken, 'atk_1');
});

console.log(`\n${passed} passed`);
await pool.end();
