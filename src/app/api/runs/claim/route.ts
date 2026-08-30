import { NextResponse, type NextRequest } from 'next/server';
import { eq, sql } from 'drizzle-orm';

import { pipelineRunKindClaimStatus } from '@/content/internal';
import { recordAudit } from '@/server/audit';
import { requireBearerToken } from '@/server/auth/api-token';
import { db } from '@/server/db/client';
import { bets, pipelineRunEvents, pipelineRunners, pipelineRuns } from '@/server/db/schema';
import { buildJobDescriptor } from '@/server/pipeline/descriptor';
import { reapExpiredRunsQuietly } from '@/server/pipeline/reap';
import { claimRequestSchema } from '@/server/validation/pipeline-runs';

// node:crypto in requireBearerToken.
export const runtime = 'nodejs';

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

  const { runnerId, kinds, leaseSeconds } = parsed.data;

  // Stamp liveness BEFORE looking for work, so a poll that finds an empty queue
  // still proves the runner is alive. That distinction is the whole point: an
  // idle scheduler and a dead one produce identical boards, and telling them
  // apart by eye took four days last time.
  await db
    .insert(pipelineRunners)
    .values({ runnerId, lastSeenAt: new Date() })
    .onConflictDoUpdate({ target: pipelineRunners.runnerId, set: { lastSeenAt: new Date() } });

  // Free lapsed leases before looking for work. This is where reaping actually
  // earns its keep: a runner polls every ~20s, so a job orphaned by a closed
  // laptop is back in the queue within one poll of somebody wanting it — rather
  // than waiting on a schedule. Never throws; failing to tidy up must not stop a
  // runner getting work.
  await reapExpiredRunsQuietly();

  // ONE statement, so the claim is atomic without an interactive transaction —
  // which matters because the neon-http driver has none (see db/client.ts).
  //
  // FOR UPDATE SKIP LOCKED is the load-bearing part: two runners polling at the
  // same instant take two different rows instead of both taking the head of the
  // queue and racing to execute the same bet.
  // Every value is a bound parameter, including the kind list — `kinds` is
  // already constrained by z.enum, but building SQL by string concatenation is
  // a habit worth not having in a route that takes a request body.
  const kindList = sql.join(
    kinds.map((kind) => sql`${kind}`),
    sql`, `
  );

  const claimed = await db.execute(sql`
    UPDATE pipeline_runs SET
      status = 'claimed',
      runner_id = ${runnerId},
      attempt = attempt + 1,
      claimed_at = now(),
      heartbeat_at = now(),
      lease_expires_at = now() + make_interval(secs => ${leaseSeconds}),
      updated_at = now()
    WHERE id = (
      SELECT id FROM pipeline_runs
      WHERE status = 'queued' AND kind IN (${kindList})
        -- A run that hit a Claude usage limit sets retry_after from the CLI's own
        -- rate_limit_event. Handing it out again before then just burns a window
        -- rediscovering the quota is still closed, which for a thrice-daily
        -- scheduler is a whole day lost.
        AND (retry_after IS NULL OR retry_after <= now())
      ORDER BY queued_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, bet_id, kind
  `);

  const rows = (claimed as unknown as { rows?: Array<Record<string, unknown>> }).rows ?? (claimed as unknown as Array<Record<string, unknown>>);
  const row = Array.isArray(rows) ? rows[0] : undefined;

  // 204, not an empty 200: an idle poller should be able to tell "no work" from
  // "work with an empty body" without parsing anything.
  if (!row) return new NextResponse(null, { status: 204 });

  const runId = String(row.id);
  const betId = row.bet_id ? String(row.bet_id) : null;
  const kind = String(row.kind) as keyof typeof pipelineRunKindClaimStatus;

  // Claiming a run is what moves the bet, and the mapping lives in the content
  // layer so adding a kind forces a decision about what it does to the board.
  // A null mapping (discovery) means this kind owns no bet and moves nothing.
  const nextBetStatus = pipelineRunKindClaimStatus[kind];
  const [bet] = betId !== null && nextBetStatus !== null
    ? await db.select({ status: bets.status, slug: bets.slug }).from(bets).where(eq(bets.id, betId)).limit(1)
    : [undefined];

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

  await db.update(pipelineRunners).set({ lastClaimedRunId: runId }).where(eq(pipelineRunners.runnerId, runnerId));
  await db.insert(pipelineRunEvents).values({ runId, level: 'info', message: `Claimed by ${runnerId}.` });
  await recordAudit({ actorId: null, entity: 'pipeline_run', entityId: runId, action: 'update', diff: { status: { from: 'queued', to: 'claimed' }, runnerId: { from: null, to: runnerId } } });

  const descriptor = await buildJobDescriptor(runId);

  // A claimed row must never be answered with `null`. The runner's HTTP client
  // parses the body before it looks at anything else, so `200 null` is
  // indistinguishable from "no work" — and the row stays claimed by a runner
  // that has already gone home, burning a full lease before the reaper frees it.
  // That exact pair cost four days of silence. Releasing the claim is the only
  // safe move: the row goes back on the queue, and the 500 says why.
  if (!descriptor) {
    await db
      .update(pipelineRuns)
      .set({ status: 'queued', runnerId: null, claimedAt: null, leaseExpiresAt: null, updatedAt: new Date() })
      .where(eq(pipelineRuns.id, runId));
    await db.insert(pipelineRunEvents).values({
      runId,
      level: 'error',
      message: `Descriptor could not be built for a ${kind} run; claim released back to the queue.`
    });
    return NextResponse.json({ ok: false, error: 'Descriptor unavailable; the run was returned to the queue.' }, { status: 500 });
  }

  return NextResponse.json(descriptor, { status: 200 });
}
