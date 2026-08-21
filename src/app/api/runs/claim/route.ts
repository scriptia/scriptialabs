import { NextResponse, type NextRequest } from 'next/server';
import { eq, sql } from 'drizzle-orm';

import { pipelineRunKindClaimStatus } from '@/content/internal';
import { recordAudit } from '@/server/audit';
import { requireBearerToken } from '@/server/auth/api-token';
import { db } from '@/server/db/client';
import { bets, pipelineRunEvents } from '@/server/db/schema';
import { buildJobDescriptor } from '@/server/pipeline/descriptor';
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
  const betId = String(row.bet_id);
  const kind = String(row.kind) as keyof typeof pipelineRunKindClaimStatus;

  // Claiming a run is what moves the bet, and the mapping lives in the content
  // layer so adding a kind forces a decision about what it does to the board.
  const nextBetStatus = pipelineRunKindClaimStatus[kind];
  const [bet] = await db.select({ status: bets.status, slug: bets.slug }).from(bets).where(eq(bets.id, betId)).limit(1);

  if (bet && bet.status !== nextBetStatus) {
    await db.update(bets).set({ status: nextBetStatus, updatedAt: new Date() }).where(eq(bets.id, betId));
    await recordAudit({
      actorId: null,
      entity: 'bet',
      entityId: betId,
      action: 'update',
      diff: { status: { from: bet.status, to: nextBetStatus } }
    });
  }

  await db.insert(pipelineRunEvents).values({ runId, level: 'info', message: `Claimed by ${runnerId}.` });
  await recordAudit({ actorId: null, entity: 'pipeline_run', entityId: runId, action: 'update', diff: { status: { from: 'queued', to: 'claimed' }, runnerId: { from: null, to: runnerId } } });

  const descriptor = await buildJobDescriptor(runId);

  return NextResponse.json(descriptor, { status: 200 });
}
