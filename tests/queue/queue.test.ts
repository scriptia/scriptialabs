// Race and state-machine tests for src/server/pipeline/queue.ts against a real Postgres.
//
// The queue's correctness is all in SQL (single-statement claims, fencing, row locks), so it is
// tested against Postgres itself, never mocked. Needs an EMPTY scratch database — the tests
// truncate every pipeline and account table:
//
//   createdb idion_test
//   DATABASE_URL=postgres://localhost/idion_test npx drizzle-kit push --force
//   TEST_DATABASE_URL=postgres://localhost/idion_test npm run test:queue
//
// A Neon branch works too; never point it at production.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { pool } from './db';
import {
  claimWithAccount,
  finishRun,
  heartbeatRun,
  leaseAccount,
  pauseRun,
  peekAccount,
  reapRun,
  releaseAccount,
  releaseExpiredAccountLeases,
  stopRun,
  unclaimRun
} from '@/server/pipeline/queue';

const q = async (text: string, params: unknown[] = []) => (await pool.query(text, params)).rows;

async function reset() {
  await q('TRUNCATE run_sessions, account_leases, provider_accounts, pipeline_run_events, pipeline_runs, bets CASCADE');
}

async function bet(slug: string) {
  const [row] = await q(`INSERT INTO bets (slug, title) VALUES ($1, $1) RETURNING id`, [slug]);
  return row.id as string;
}

async function run(kind: string, betId: string | null, extra = '') {
  const [row] = await q(`INSERT INTO pipeline_runs (kind, bet_id${extra ? ', status' : ''}) VALUES ($1, $2${extra ? ', $3' : ''}) RETURNING id`,
    extra ? [kind, betId, extra] : [kind, betId]);
  return row.id as string;
}

async function account(provider: string, label: string, maxConcurrency = 1) {
  const [row] = await q(`INSERT INTO provider_accounts (provider, label, credential_type, secret_encrypted, max_concurrency)
    VALUES ($1, $2, 'oauth_token', 'x:y:z', $3) RETURNING id`, [provider, label, maxConcurrency]);
  return row.id as string;
}

const kinds = ['discovery', 'product-agent', 'build'] as const;
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

await test('50 parallel claims, 3 jobs, 2 accounts: exactly 2 claims, no account double-leased', async () => {
  for (const slug of ['a', 'b', 'c']) await run('product-agent', await bet(slug));
  const a = await account('claude', 'max-a');
  const b = await account('claude', 'max-b');
  const results = await Promise.all(Array.from({ length: 50 }, (_, i) => claimWithAccount({ runnerId: `m-${i % 5}`, kinds, leaseSeconds: 900 })));
  const claimed = results.filter((r) => r.claimed) as Extract<(typeof results)[number], { claimed: true }>[];
  assert.equal(claimed.length, 2);
  assert.equal(new Set(claimed.map((r) => r.runId)).size, 2);
  assert.deepEqual(new Set(claimed.map((r) => r.account!.id)), new Set([a, b]));
  const accounts = await q(`SELECT active_leases FROM provider_accounts ORDER BY label`);
  assert.deepEqual(accounts.map((r) => r.active_leases), [1, 1]);
  assert.equal((await q(`SELECT count(*)::int n FROM account_leases WHERE released_at IS NULL`))[0].n, 2);
  assert.equal((await q(`SELECT count(*)::int n FROM run_sessions`))[0].n, 2);
  const idle = results.find((r) => !r.claimed) as Extract<(typeof results)[number], { claimed: false }>;
  assert.equal(idle.reason, 'no_accounts');
});

await test('fencing: a stale token cannot heartbeat, pause or complete', async () => {
  const runId = await run('product-agent', await bet('a'));
  await account('claude', 'max-a');
  const claim = await claimWithAccount({ runnerId: 'm1', kinds, leaseSeconds: 900 });
  assert.ok(claim.claimed);
  const stale = { runnerId: 'm1', leaseToken: randomUUID() };
  assert.equal(await heartbeatRun({ runId, holder: stale, leaseSeconds: 900, stage: 'x', progress: {} }), null);
  assert.equal(await pauseRun({ runId, holder: stale, reason: 'x' }), null);
  assert.equal(await finishRun({ runId, holder: stale, status: 'succeeded' }), null);
  const beat = await heartbeatRun({ runId, holder: { runnerId: 'm1', leaseToken: claim.leaseToken }, leaseSeconds: 900, stage: 'identity', progress: { stage: 'identity' } });
  assert.equal(beat?.status, 'running');
  assert.equal(beat?.accountLeases, 1);
});

await test('pause limits the account, releases it, and the run resumes on the other account', async () => {
  const r1 = await run('product-agent', await bet('a'));
  const r2 = await run('product-agent', await bet('b'));
  const a = await account('claude', 'max-a');
  const b = await account('claude', 'max-b');
  const c1 = await claimWithAccount({ runnerId: 'm1', kinds, leaseSeconds: 900 });
  const c2 = await claimWithAccount({ runnerId: 'm2', kinds, leaseSeconds: 900 });
  assert.ok(c1.claimed && c2.claimed);
  const first = c1.runId === r1 ? c1 : c2;
  const second = first === c1 ? c2 : c1;
  const until = new Date(Date.now() + 3 * 3600 * 1000);
  const paused = await pauseRun({
    runId: first.runId, holder: { runnerId: 'x', leaseToken: first.leaseToken }, reason: 'Claude limit',
    limitedAccount: { accountId: first.account!.id, until }, checkpoint: { sha256: 'abc', parts: [] }
  });
  assert.equal(paused?.sessionCount, 1);
  assert.ok(paused?.limitedUntil);
  const [acct] = await q(`SELECT active_leases, limited_until FROM provider_accounts WHERE id = $1`, [first.account!.id]);
  assert.equal(acct.active_leases, 0);
  assert.ok(acct.limited_until > new Date());
  assert.equal((await q(`SELECT end_reason FROM run_sessions WHERE run_id = $1`, [first.runId]))[0].end_reason, 'limit');

  // Only account is limited, the other busy: nothing to claim, and it says why.
  const idle = await claimWithAccount({ runnerId: 'm1', kinds, leaseSeconds: 900 });
  assert.equal(idle.claimed, false);
  assert.equal((idle as { reason: string }).reason, 'no_accounts');
  assert.ok((idle as { nextAccountAt: Date | null }).nextAccountAt);

  // The other job finishes; its account frees; the paused run is claimed with it.
  const done = await finishRun({ runId: second.runId, holder: { runnerId: 'm2', leaseToken: second.leaseToken }, status: 'succeeded' });
  assert.equal(done?.released, 1);
  const resumed = await claimWithAccount({ runnerId: 'm1', kinds, leaseSeconds: 900 });
  assert.ok(resumed.claimed);
  assert.equal(resumed.runId, first.runId);
  assert.equal(resumed.previousStatus, 'paused');
  assert.equal(resumed.sessionSeq, 2);
  assert.equal(resumed.account!.id, second.account!.id);
  assert.notEqual(resumed.account!.id, first.account!.id);
  void a; void b; void r2;
});

await test('reaper: a lapsed lease with a stop request ends cancelled and frees its account', async () => {
  const runId = await run('product-agent', await bet('a'));
  const a = await account('claude', 'max-a');
  const c = await claimWithAccount({ runnerId: 'm1', kinds, leaseSeconds: 900 });
  assert.ok(c.claimed);
  await q(`UPDATE pipeline_runs SET lease_expires_at = now() - interval '1 minute', cancel_requested_at = now() WHERE id = $1`, [runId]);
  assert.equal(await reapRun({ runId, next: 'cancelled', message: 'x' }), true);
  const [r] = await q(`SELECT status, lease_token, attempt FROM pipeline_runs WHERE id = $1`, [runId]);
  assert.equal(r.status, 'cancelled');
  assert.equal(r.lease_token, null);
  assert.equal((await q(`SELECT active_leases FROM provider_accounts WHERE id = $1`, [a]))[0].active_leases, 0);
  assert.equal((await q(`SELECT end_reason FROM run_sessions WHERE run_id = $1`, [runId]))[0].end_reason, 'lease_lost');
  // A heartbeat that arrives now is fenced out.
  assert.equal(await heartbeatRun({ runId, holder: { runnerId: 'm1', leaseToken: c.leaseToken }, leaseSeconds: 900, progress: {} }), null);
});

await test('reaper does nothing to a run whose heartbeat already renewed the lease', async () => {
  const runId = await run('product-agent', await bet('a'));
  await account('claude', 'max-a');
  const c = await claimWithAccount({ runnerId: 'm1', kinds, leaseSeconds: 900 });
  assert.ok(c.claimed);
  assert.equal(await reapRun({ runId, next: 'paused', message: 'x' }), false);
});

await test('an expired lease is fenced even before the reaper runs', async () => {
  const runId = await run('product-agent', await bet('a'));
  await account('claude', 'max-a');
  const c = await claimWithAccount({ runnerId: 'm1', kinds, leaseSeconds: 900 });
  assert.ok(c.claimed);
  await q(`UPDATE pipeline_runs SET lease_expires_at = now() - interval '1 second' WHERE id = $1`, [runId]);
  assert.equal(await finishRun({ runId, holder: { runnerId: 'm1', leaseToken: c.leaseToken }, status: 'succeeded' }), null);
});

await test('discovery: one in flight, even with 20 machines racing', async () => {
  await run('discovery', null);
  await run('discovery', null);
  await run('discovery', null);
  for (let i = 0; i < 5; i++) await account('claude', `max-${i}`);
  const results = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => claimWithAccount({ runnerId: `m-${i}`, kinds: ['discovery'], leaseSeconds: 900 })));
  const claimed = results.filter((r) => r.status === 'fulfilled' && r.value.claimed);
  const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
  for (const r of rejected) assert.match(String((r.reason as Error).message ?? r.reason), /duplicate key|one_discovery/);
  assert.equal(claimed.length, 1);
  assert.equal((await q(`SELECT count(*)::int n FROM pipeline_runs WHERE status = 'claimed'`))[0].n, 1);
  assert.equal((await q(`SELECT sum(active_leases)::int n FROM provider_accounts`))[0].n, 1);
});

await test('stop: queued and paused are cancelled at once; running is flagged', async () => {
  const queued = await run('product-agent', await bet('a'));
  assert.equal(await stopRun(queued), 'cancelled');
  const r = await run('product-agent', await bet('b'));
  await account('claude', 'max-a');
  const c = await claimWithAccount({ runnerId: 'm1', kinds, leaseSeconds: 900 });
  assert.ok(c.claimed && c.runId === r);
  assert.equal(await stopRun(r), 'requested');
  const beat = await heartbeatRun({ runId: r, holder: { runnerId: 'm1', leaseToken: c.leaseToken }, leaseSeconds: 900, progress: {} });
  assert.equal(beat?.cancelRequested, true);
  // A flagged run is no longer claimable after a pause either.
  await pauseRun({ runId: r, holder: { runnerId: 'm1', leaseToken: c.leaseToken }, reason: 'limit' });
  assert.equal(await stopRun(r), 'cancelled');
  assert.equal(await stopRun(r), 'finished');
});

await test('platform leases: prefer, exclude, limit on release, read-only peek, expiry sweep', async () => {
  const runId = await run('build', await bet('a'));
  await account('claude', 'max-a');
  const e1 = await account('eas', 'expo-1');
  const e2 = await account('eas', 'expo-2');
  const c = await claimWithAccount({ runnerId: 'm1', kinds, leaseSeconds: 900 });
  assert.ok(c.claimed);
  const holder = { runnerId: 'm1', leaseToken: c.leaseToken };
  const preferred = await leaseAccount({ runId, holder, provider: 'eas', prefer: e2 });
  assert.equal(preferred.account?.id, e2);
  const other = await leaseAccount({ runId, holder, provider: 'eas', exclude: [e2] });
  assert.equal(other.account?.id, e1);
  const none = await leaseAccount({ runId, holder, provider: 'eas' });
  assert.equal(none.account, null);
  const until = new Date(Date.now() + 20 * 86400 * 1000);
  assert.equal(await releaseAccount({ accountId: e2, runId, holder, limitedUntil: until, reason: 'quota', quota: { used: 15 } }), true);
  assert.equal(await releaseAccount({ accountId: e2, runId, holder }), false, 'a second release matches nothing');
  const [row] = await q(`SELECT active_leases, limited_until, quota FROM provider_accounts WHERE id = $1`, [e2]);
  assert.equal(row.active_leases, 0);
  assert.equal(row.quota.used, 15);
  const peeked = await peekAccount({ runId, holder, provider: 'eas', accountId: e2 });
  assert.equal(peeked?.id, e2, 'a limited account can still be read by the run');
  // complete releases the remaining platform lease (e1) and the Claude one.
  const done = await finishRun({ runId, holder, status: 'succeeded' });
  assert.equal(done?.released, 2);
  assert.equal((await q(`SELECT sum(active_leases)::int n FROM provider_accounts`))[0].n, 0);
  assert.equal(await releaseExpiredAccountLeases(), 0);
});

await test('unclaim restores the run and its account exactly', async () => {
  const runId = await run('product-agent', await bet('a'));
  const a = await account('claude', 'max-a');
  const c = await claimWithAccount({ runnerId: 'm1', kinds, leaseSeconds: 900 });
  assert.ok(c.claimed);
  assert.equal(await unclaimRun({ runId, holder: { runnerId: 'm1', leaseToken: c.leaseToken }, previousStatus: 'queued' }), true);
  const [r] = await q(`SELECT status, session_count FROM pipeline_runs WHERE id = $1`, [runId]);
  assert.equal(r.status, 'queued');
  assert.equal(r.session_count, 0);
  assert.equal((await q(`SELECT active_leases FROM provider_accounts WHERE id = $1`, [a]))[0].active_leases, 0);
  const again = await claimWithAccount({ runnerId: 'm1', kinds, leaseSeconds: 900 });
  assert.ok(again.claimed);
  assert.equal(again.sessionSeq, 1, 'the session row is reused, not duplicated');
});

console.log(`\n${passed} passed`);
await pool.end();
