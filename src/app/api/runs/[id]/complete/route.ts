import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';

import { recordAudit } from '@/server/audit';
import { requireBearerToken } from '@/server/auth/api-token';
import { db } from '@/server/db/client';
import { bets, pipelineRunEvents, pipelineRuns, products } from '@/server/db/schema';
import { requireLease } from '@/server/pipeline/lease';
import { completeRequestSchema } from '@/server/validation/pipeline-runs';

export const runtime = 'nodejs';

// The terminal callback. After this the lease is gone and every further callback
// for this run is a 409 — which is exactly what stops a woken-up zombie process
// reporting on work that was reassigned.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireBearerToken(request, 'PIPELINE_RUNNER_TOKEN');
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Body is not valid JSON.' }, { status: 400 });
  }

  const parsed = completeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Payload failed validation.', issues: parsed.error.issues }, { status: 422 });
  }

  const lease = await requireLease(id, parsed.data.runnerId);
  if (!lease.ok) return lease.response;

  const now = new Date();
  const { status, error, result, externalRunId, logUrl } = parsed.data;

  await db
    .update(pipelineRuns)
    .set({
      status,
      error: error ?? null,
      result: result ?? null,
      finishedAt: now,
      updatedAt: now,
      // The lease is released explicitly rather than left to expire, so the
      // reaper never has to reason about a run that is already done.
      leaseExpiresAt: null,
      ...(externalRunId ? { externalRunId } : {}),
      ...(logUrl ? { logUrl } : {})
    })
    .where(eq(pipelineRuns.id, id));

  await db.insert(pipelineRunEvents).values({
    runId: id,
    level: status === 'succeeded' ? 'info' : 'warn',
    message: status === 'succeeded' ? 'Run finished.' : `Run ${status}${error ? `: ${error.slice(0, 300)}` : '.'}`
  });

  const betStatus = await settleBetStatus(lease.run.betId, lease.run.kind, status);

  await recordAudit({
    actorId: null,
    entity: 'pipeline_run',
    entityId: id,
    action: 'update',
    diff: { status: { from: lease.run.status, to: status } }
  });

  return NextResponse.json({ ok: true, run: { id, status, finishedAt: now.toISOString() }, betStatus });
}

/**
 * Where the bet lands when a run ends.
 *
 * A SUCCEEDED run does not move the bet here: the publish call is what asserts
 * "a public page exists", and it sets `ready` itself. A run can succeed having
 * published nothing (product-agent's judge returning INSUFFICIENT is a valid
 * outcome), and claiming `ready` for that would make the board lie.
 *
 * A FAILED or CANCELLED run rewinds the bet, but only if nothing was published —
 * otherwise a failed re-run would unpublish a live product.
 */
async function settleBetStatus(betId: string, kind: string, runStatus: string): Promise<string | null> {
  if (runStatus === 'succeeded') return null;

  const [bet] = await db.select({ status: bets.status }).from(bets).where(eq(bets.id, betId)).limit(1);
  if (!bet) return null;

  const [published] = await db.select({ id: products.id }).from(products).where(eq(products.betId, betId)).limit(1);
  if (published) return null;

  // Only rewind the status this kind of run set when it claimed the bet.
  const claimedStatus = kind === 'build' ? 'building' : 'researching';
  if (bet.status !== claimedStatus) return null;

  const rewindTo = kind === 'build' ? 'ready' : 'backlog';
  await db.update(bets).set({ status: rewindTo, updatedAt: new Date() }).where(eq(bets.id, betId));
  await recordAudit({
    actorId: null,
    entity: 'bet',
    entityId: betId,
    action: 'update',
    diff: { status: { from: bet.status, to: rewindTo } }
  });

  return rewindTo;
}
