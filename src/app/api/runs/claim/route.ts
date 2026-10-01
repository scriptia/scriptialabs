import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';

import { pipelineRunKindClaimStatus } from '@/content/internal';
import { recordAudit } from '@/server/audit';
import { requireBearerToken } from '@/server/auth/api-token';
import { db } from '@/server/db/client';
import { bets, pipelineRunEvents, pipelineRunners } from '@/server/db/schema';
import { buildJobDescriptor } from '@/server/pipeline/descriptor';
import { claimLegacy, claimWithAccount, unclaimRun, type ClaimResult } from '@/server/pipeline/queue';
import { reapExpiredRunsQuietly } from '@/server/pipeline/reap';
import { claimRequestSchema } from '@/server/validation/pipeline-runs';
import { openSecret } from '@/server/vault/crypto';

// node:crypto in requireBearerToken and the vault.
export const runtime = 'nodejs';

// Postgres unique violation. On claim it means two machines raced for the only
// discovery slot and this one lost at the index — which is "no work", not an error.
const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if ((error as { code?: unknown }).code === UNIQUE_VIOLATION) return true;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' && message.includes('pipeline_runs_one_discovery_in_flight');
}

// 204, not an empty 200: an idle poller tells "no work" from "work" without
// parsing anything. A 204 carries no body, so the WHY rides in headers:
//
//   X-Idle-Reason: no_work | no_accounts
//   X-Next-Account-At: when the first limited Claude account resets (ISO)
//   X-Next-Retry-At: when the first held-back run becomes claimable (ISO)
//
// With `no_accounts` the orchestrator sleeps until X-Next-Account-At rather
// than polling a closed window every 20 seconds.
function idle(result: Extract<ClaimResult, { claimed: false }>) {
  const headers = new Headers({ 'X-Idle-Reason': result.reason });
  if (result.nextAccountAt) headers.set('X-Next-Account-At', result.nextAccountAt.toISOString());
  if (result.nextRetryAt) headers.set('X-Next-Retry-At', result.nextRetryAt.toISOString());
  return new NextResponse(null, { status: 204, headers });
}

export async function POST(request: NextRequest) {
  const auth = requireBearerToken(request, 'PIPELINE_RUNNER_TOKEN');
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Body is not valid JSON.' }, { status: 400 });
  }

  const parsed = claimRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Payload failed validation.', issues: parsed.error.issues }, { status: 422 });
  }

  const { runnerId, kinds, leaseSeconds, protocol } = parsed.data;
  const machine = {
    host: parsed.data.host ?? null,
    version: parsed.data.version ?? null,
    capacity: parsed.data.capacity ?? null,
    activeRuns: parsed.data.activeRuns ?? null,
    kinds: [...kinds],
    tools: parsed.data.tools ?? null
  };

  // Stamp liveness BEFORE looking for work, so a poll that finds an empty queue
  // still proves the runner is alive. That distinction is the whole point: an
  // idle scheduler and a dead one produce identical boards, and telling them
  // apart by eye took four days last time.
  const now = new Date();
  await db
    .insert(pipelineRunners)
    .values({ runnerId, lastSeenAt: now, ...machine })
    .onConflictDoUpdate({
      target: pipelineRunners.runnerId,
      set: { lastSeenAt: now, ...Object.fromEntries(Object.entries(machine).filter(([, value]) => value !== null)) }
    });

  // Free lapsed leases before looking for work. This is where reaping actually
  // earns its keep: a runner polls every ~20s, so a job orphaned by a closed
  // laptop is back in the queue within one poll of somebody wanting it — rather
  // than waiting on a schedule. Never throws; failing to tidy up must not stop a
  // runner getting work.
  await reapExpiredRunsQuietly();

  // ONE statement per claim (server/pipeline/queue.ts): the run, the Claude
  // account, the lease and the session row are taken together or not at all,
  // with FOR UPDATE SKIP LOCKED on both the run and the account so two machines
  // polling at the same instant can never take the same job or the same account.
  let result: ClaimResult;
  try {
    result = protocol === 2 ? await claimWithAccount({ runnerId, kinds, leaseSeconds }) : await claimLegacy({ runnerId, kinds, leaseSeconds });
  } catch (error) {
    if (isUniqueViolation(error)) return idle({ claimed: false, reason: 'no_work', nextAccountAt: null, nextRetryAt: null });
    throw error;
  }

  if (!result.claimed) return idle(result);

  const { runId, betId, kind, leaseToken, sessionSeq, previousStatus, account } = result;
  const holder = { runnerId, leaseToken };

  // A claimed row must never be answered with anything the runner cannot act
  // on. The account secret and the descriptor are checked BEFORE the claim is
  // reported anywhere; if either is unavailable the claim is undone (fenced on
  // the token it just issued) and the 500 says why. Leaving it claimed would
  // strand the run AND the account for a full lease.
  let secret: string | null = null;
  if (account) {
    try {
      secret = openSecret(account.secretEncrypted);
    } catch (error) {
      await unclaimRun({ runId, holder, previousStatus });
      await db.insert(pipelineRunEvents).values({
        runId,
        level: 'error',
        message: `Account "${account.label}" could not be decrypted (${error instanceof Error ? error.message : 'vault error'}); claim released.`
      });
      return NextResponse.json({ ok: false, error: 'The account vault could not open the leased account; the run was returned to the queue.' }, { status: 500 });
    }
  }

  const descriptor = await buildJobDescriptor(runId);

  if (!descriptor) {
    await unclaimRun({ runId, holder, previousStatus });
    await db.insert(pipelineRunEvents).values({
      runId,
      level: 'error',
      message: `Descriptor could not be built for a ${kind} run; claim released back to the queue.`
    });
    return NextResponse.json({ ok: false, error: 'Descriptor unavailable; the run was returned to the queue.' }, { status: 500 });
  }

  // Claiming a run is what moves the bet, and the mapping lives in the content
  // layer so adding a kind forces a decision about what it does to the board.
  // A null mapping (discovery) means this kind owns no bet and moves nothing.
  // A resumed build is already `building`, so this is a no-op for it.
  const nextBetStatus = pipelineRunKindClaimStatus[kind];
  const [bet] =
    betId !== null && nextBetStatus !== null ? await db.select({ status: bets.status, slug: bets.slug }).from(bets).where(eq(bets.id, betId)).limit(1) : [undefined];

  if (bet && nextBetStatus && betId && bet.status !== nextBetStatus) {
    await db.update(bets).set({ status: nextBetStatus, updatedAt: new Date() }).where(eq(bets.id, betId));
    await recordAudit({
      actorId: null,
      entity: 'bet',
      entityId: betId,
      action: 'update',
      diff: { status: { from: bet.status, to: nextBetStatus } }
    });
  }

  const resumed = previousStatus === 'paused';
  await db.update(pipelineRunners).set({ lastClaimedRunId: runId }).where(eq(pipelineRunners.runnerId, runnerId));
  await db.insert(pipelineRunEvents).values({
    runId,
    level: 'info',
    message: resumed
      ? `Resumed by ${runnerId} — session ${sessionSeq}${account ? ` on account "${account.label}"` : ''}.`
      : `Claimed by ${runnerId}${account ? ` on account "${account.label}"` : ''}.`,
    data: account ? { accountId: account.id, sessionSeq } : { sessionSeq }
  });
  await recordAudit({
    actorId: null,
    entity: 'pipeline_run',
    entityId: runId,
    action: 'update',
    diff: { status: { from: previousStatus, to: 'claimed' }, runnerId: { from: null, to: runnerId } }
  });

  return NextResponse.json(
    {
      ...descriptor,
      session: { seq: sessionSeq, leaseToken, sessionId: result.sessionId, resumed },
      account: account ? { id: account.id, label: account.label, identity: account.identity, credentialType: account.credentialType, secret } : null
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  );
}
