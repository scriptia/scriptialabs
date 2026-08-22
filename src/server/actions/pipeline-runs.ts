'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, inArray } from 'drizzle-orm';

import { activePipelineRunStatuses, isTerminalPipelineRunStatus, type PipelineRunKind } from '@/content/internal';
import { recordAudit } from '@/server/audit';
import { requireUser } from '@/server/auth/guard';
import { db } from '@/server/db/client';
import { bets, pipelineRunEvents, pipelineRuns } from '@/server/db/schema';
import { getRunEvents, getRun } from '@/server/queries/pipeline-runs';
import { buildParamsSchema, discoveryParamsSchema, productAgentParamsSchema } from '@/server/validation/pipeline-runs';

export type RunActionState = { error?: string; ok?: boolean; runId?: string };

// Postgres raises 23505 on a unique-index violation. The partial unique index
// `pipeline_runs_one_active` is what actually prevents a second in-flight run
// for the same bet, so this is the intended path for a double-click or two
// admins pressing the button at once — not an exceptional case.
const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  if (code === UNIQUE_VIOLATION) return true;
  // The neon-http driver surfaces the server error through a wrapper whose
  // message carries the constraint name.
  return typeof (error as { message?: unknown }).message === 'string' && (error as { message: string }).message.includes('pipeline_runs_one_active');
}

/** Statuses a bet may be in for each kind of run to be a sensible thing to start. */
const ALLOWED_BET_STATUS: Record<PipelineRunKind, readonly string[]> = {
  // Discovery has no bet, so there is no source status to check.
  discovery: [],
  // A bet the discovery pipeline dropped in the backlog. `killed` is allowed so
  // a rescued bet can be run without a detour through the edit form.
  'product-agent': ['backlog', 'ready', 'killed'],
  // Only after product-agent has published: the build consumes its artifacts.
  build: ['ready']
};

async function queueRun(kind: PipelineRunKind, formData: FormData): Promise<RunActionState> {
  const user = await requireUser();
  const betId = String(formData.get('betId') ?? '');

  if (!betId) return { error: 'Missing bet reference.' };

  const schema = kind === 'build' ? buildParamsSchema : productAgentParamsSchema;
  const parsed = schema.safeParse({
    publishLegal: formData.get('publishLegal'),
    createFeatures: formData.get('createFeatures'),
    externalRunId: formData.get('externalRunId') || undefined,
    force: formData.get('force')
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Those parameters are not valid.' };
  }

  const [bet] = await db.select({ id: bets.id, slug: bets.slug, status: bets.status }).from(bets).where(eq(bets.id, betId)).limit(1);

  if (!bet) return { error: 'That bet no longer exists.' };

  if (!ALLOWED_BET_STATUS[kind].includes(bet.status)) {
    return {
      error:
        kind === 'build'
          ? `This bet is "${bet.status}". A build runs from "ready" — publish a product first.`
          : `This bet is "${bet.status}". Move it back to the backlog to run the product agent again.`
    };
  }

  try {
    const [created] = await db
      .insert(pipelineRuns)
      .values({
        betId: bet.id,
        kind,
        status: 'queued',
        params: parsed.data as Record<string, unknown>,
        externalRunId: parsed.data.externalRunId ?? null,
        requestedById: user.id
      })
      .returning({ id: pipelineRuns.id });

    await db.insert(pipelineRunEvents).values({
      runId: created.id,
      level: 'info',
      message: `Queued by ${user.name}.`,
      data: parsed.data as Record<string, unknown>
    });

    await recordAudit({
      actorId: user.id,
      entity: 'pipeline_run',
      entityId: created.id,
      action: 'create',
      diff: { kind: { from: null, to: kind }, bet: { from: null, to: bet.slug } }
    });

    revalidatePath(`/internal/bets/${bet.slug}`);
    revalidatePath('/internal/runs');

    return { ok: true, runId: created.id };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: 'A run of this kind is already in flight for this bet.' };
    }
    throw error;
  }
}

/**
 * Queues a discovery run — a market hunt, not tied to any bet.
 *
 * Deliberately allows several to be queued at once: they are cheap rows, and the
 * scheduler runs them one at a time anyway. What must NOT happen is two runs
 * writing the same run directory, and that is prevented where it can actually be
 * checked — on the runner, which reads the filesystem and picks the next free id.
 */
export async function queueDiscoveryRun(_state: RunActionState, formData: FormData): Promise<RunActionState> {
  const user = await requireUser();

  const parsed = discoveryParamsSchema.safeParse({
    mode: formData.get('mode') || 'new',
    externalRunId: formData.get('externalRunId') || undefined,
    markets: formData.get('markets') || undefined,
    marketsCount: formData.get('marketsCount') || undefined,
    maxParallel: formData.get('maxParallel') || undefined,
    budgetUsd: formData.get('budgetUsd') || undefined
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Those parameters are not valid.' };
  }

  if (parsed.data.mode === 'resume' && !parsed.data.externalRunId) {
    return { error: 'Resuming needs the run id to resume (e.g. 2026-W36).' };
  }

  // One discovery run in flight at a time. They are long, they share the roster
  // cursor, and two at once would fight over it.
  const [active] = await db
    .select({ id: pipelineRuns.id })
    .from(pipelineRuns)
    .where(and(eq(pipelineRuns.kind, 'discovery'), inArray(pipelineRuns.status, [...activePipelineRunStatuses])))
    .limit(1);

  if (active) return { error: 'A discovery run is already queued or in flight.' };

  const [created] = await db
    .insert(pipelineRuns)
    .values({
      betId: null,
      kind: 'discovery',
      status: 'queued',
      params: parsed.data as Record<string, unknown>,
      externalRunId: parsed.data.externalRunId ?? null,
      requestedById: user.id
    })
    .returning({ id: pipelineRuns.id });

  await db.insert(pipelineRunEvents).values({
    runId: created.id,
    level: 'info',
    message: `Queued by ${user.name} (${parsed.data.mode}${parsed.data.externalRunId ? ` ${parsed.data.externalRunId}` : ''}).`,
    data: parsed.data as Record<string, unknown>
  });

  await recordAudit({ actorId: user.id, entity: 'pipeline_run', entityId: created.id, action: 'create', diff: { kind: { from: null, to: 'discovery' } } });

  revalidatePath('/internal/runs');
  revalidatePath('/internal');

  return { ok: true, runId: created.id };
}

export async function queueProductAgentRun(_state: RunActionState, formData: FormData): Promise<RunActionState> {
  return queueRun('product-agent', formData);
}

export async function queueBuildRun(_state: RunActionState, formData: FormData): Promise<RunActionState> {
  return queueRun('build', formData);
}

/**
 * Requests a graceful stop.
 *
 * A queued run is cancelled outright — nothing has claimed it. An in-flight run
 * is only FLAGGED: the runner sees `cancelRequested` on its next heartbeat and
 * touches its STOP file, halting at a session boundary. Killing it mid-stage
 * would leave half-written artifacts and a claimed row nobody will ever complete.
 */
export async function cancelRun(formData: FormData): Promise<RunActionState> {
  const user = await requireUser();
  const runId = String(formData.get('runId') ?? '');
  if (!runId) return { error: 'Missing run reference.' };

  const run = await getRun(runId);
  if (!run) return { error: 'That run no longer exists.' };
  if (isTerminalPipelineRunStatus(run.status)) return { error: `That run already finished (${run.status}).` };

  const now = new Date();

  if (run.status === 'queued') {
    await db
      .update(pipelineRuns)
      .set({ status: 'cancelled', cancelRequestedAt: now, finishedAt: now, updatedAt: now })
      .where(and(eq(pipelineRuns.id, runId), eq(pipelineRuns.status, 'queued')));
    await db.insert(pipelineRunEvents).values({ runId, level: 'warn', message: `Cancelled by ${user.name} before it was claimed.` });
  } else {
    await db.update(pipelineRuns).set({ cancelRequestedAt: now, updatedAt: now }).where(eq(pipelineRuns.id, runId));
    await db.insert(pipelineRunEvents).values({
      runId,
      level: 'warn',
      message: `Stop requested by ${user.name}. The runner halts at the next stage boundary.`
    });
  }

  await recordAudit({ actorId: user.id, entity: 'pipeline_run', entityId: runId, action: 'update', diff: { cancelRequested: { from: null, to: true } } });

  if (run.betSlug) revalidatePath(`/internal/bets/${run.betSlug}`);
  revalidatePath('/internal/runs');
  revalidatePath(`/internal/runs/${runId}`);

  return { ok: true };
}

/** Re-queues a finished run's parameters as a new run. */
export async function retryRun(formData: FormData): Promise<RunActionState> {
  const user = await requireUser();
  const runId = String(formData.get('runId') ?? '');
  if (!runId) return { error: 'Missing run reference.' };

  const run = await getRun(runId);
  if (!run) return { error: 'That run no longer exists.' };
  if (!isTerminalPipelineRunStatus(run.status)) return { error: 'That run is still in flight.' };

  // A discovery run has no bet, so there is nothing to collide with here — its
  // one-at-a-time rule is enforced by run id on the runner side.
  const [active] = run.betId
    ? await db
        .select({ id: pipelineRuns.id })
        .from(pipelineRuns)
        .where(and(eq(pipelineRuns.betId, run.betId), eq(pipelineRuns.kind, run.kind), inArray(pipelineRuns.status, [...activePipelineRunStatuses])))
        .limit(1)
    : [undefined];

  if (active) return { error: 'A run of this kind is already in flight for this bet.' };

  const [created] = await db
    .insert(pipelineRuns)
    .values({
      betId: run.betId,
      kind: run.kind,
      status: 'queued',
      params: run.params,
      externalRunId: run.externalRunId,
      requestedById: user.id
    })
    .returning({ id: pipelineRuns.id });

  await db.insert(pipelineRunEvents).values({ runId: created.id, level: 'info', message: `Re-queued by ${user.name} from run ${runId}.` });
  await recordAudit({ actorId: user.id, entity: 'pipeline_run', entityId: created.id, action: 'create', diff: { retryOf: { from: null, to: runId } } });

  if (run.betSlug) revalidatePath(`/internal/bets/${run.betSlug}`);
  revalidatePath('/internal/runs');

  return { ok: true, runId: created.id };
}

/**
 * One poll tick for the run detail page.
 *
 * A server action rather than an API route: ADR-010 keeps the panel's whole
 * surface in server actions, and a 5-second poll against an hours-long job is
 * cheap enough that SSE would be complexity for its own sake. `sinceIso` means
 * each tick fetches only what is new.
 */
export async function getRunSnapshot(runId: string, sinceIso?: string) {
  await requireUser();

  const [run, events] = await Promise.all([getRun(runId), getRunEvents(runId, sinceIso)]);
  if (!run) return null;

  return {
    status: run.status,
    progress: run.progress,
    error: run.error,
    attempt: run.attempt,
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    heartbeatAt: run.heartbeatAt?.toISOString() ?? null,
    cancelRequested: Boolean(run.cancelRequestedAt),
    events: events.map((event) => ({
      id: event.id,
      at: event.at.toISOString(),
      level: event.level,
      stage: event.stage,
      message: event.message
    }))
  };
}
