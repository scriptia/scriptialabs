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
  const { status, error, result, externalRunId, logUrl, retryAfterEpoch } = parsed.data;

  // BLOCKED is not a completion. A Claude usage or spend limit ended the session,
  // so nothing was measured and there is no outcome to record — the run goes back
  // to `queued` behind a retryAfter and the next scheduled pass picks it up
  // exactly where it left off. Recording it as `failed` is what would turn "come
  // back at 17:30" into "this job is dead", which for something running
  // unattended for days is the difference between working and not.
  if (status === 'blocked') {
    // Default 1 hour if the CLI gave no epoch: long enough not to thrash, short
    // enough that a wrong guess costs one window rather than a day.
    const retryAfter = retryAfterEpoch ? new Date(retryAfterEpoch * 1000) : new Date(now.getTime() + 60 * 60 * 1000);

    await db
      .update(pipelineRuns)
      .set({
        status: 'queued',
        runnerId: null,
        claimedAt: null,
        leaseExpiresAt: null,
        retryAfter,
        blockedReason: error ?? 'Claude usage limit',
        updatedAt: now,
        // Not counted as an attempt: the session never ran, so charging it one
        // would exhaust maxAttempts on quota alone and give up on real work.
        ...(externalRunId ? { externalRunId } : {})
      })
      .where(eq(pipelineRuns.id, id));

    await db.insert(pipelineRunEvents).values({
      runId: id,
      level: 'warn',
      message: `Quota reached; nothing was measured. Re-queued, next attempt after ${retryAfter.toISOString()}.`
    });

    return NextResponse.json({ ok: true, run: { id, status: 'queued', retryAfter: retryAfter.toISOString() }, requeued: true });
  }

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

  const betStatus = lease.run.betId ? await settleBetStatus(lease.run.betId, lease.run.kind, status) : null;

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
 * A SUCCEEDED run does not move the bet: the publish call is what asserts "a
 * public page exists", and it sets `ready` itself. A run can succeed having
 * published nothing (product-agent's judge returning INSUFFICIENT is a valid
 * outcome), and claiming `ready` for that would make the board lie.
 *
 * A BUILD run never moves the bet either, in any outcome. Once a bet reaches
 * Building it stays there until a human moves it on or something calls the
 * status endpoint — a build hands off artifacts and stops by design, so Building
 * is the expected resting state and nothing automated gets to overrule it. If a
 * build fails, the run says so and the bet waits for a person.
 *
 * That leaves exactly one automatic transition here: a product-agent run that
 * failed or was cancelled without publishing anything releases the bet back to
 * `backlog`, so the trigger button works again. Guarded on a product row: a
 * failed re-run must never unpublish a live product.
 */
async function settleBetStatus(betId: string, kind: string, runStatus: string): Promise<string | null> {
  if (runStatus === 'succeeded' || kind === 'build') return null;

  const [bet] = await db.select({ status: bets.status }).from(bets).where(eq(bets.id, betId)).limit(1);
  if (!bet || bet.status !== 'researching') return null;

  const [published] = await db.select({ id: products.id }).from(products).where(eq(products.betId, betId)).limit(1);
  if (published) return null;

  await db.update(bets).set({ status: 'backlog', updatedAt: new Date() }).where(eq(bets.id, betId));
  await recordAudit({
    actorId: null,
    entity: 'bet',
    entityId: betId,
    action: 'update',
    diff: { status: { from: 'researching', to: 'backlog' } }
  });

  return 'backlog';
}
