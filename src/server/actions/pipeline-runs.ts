'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, inArray } from 'drizzle-orm';

import { z } from 'zod';

import { activePipelineRunStatuses, availableDeployTargets, isTerminalPipelineRunStatus, type PipelineRunKind } from '@/content/internal';
import { recordAudit } from '@/server/audit';
import { requireUser } from '@/server/auth/guard';
import { db } from '@/server/db/client';
import { appDeployments, bets, pipelineRunEvents, pipelineRuns } from '@/server/db/schema';
import { stopRun as stopRunInQueue } from '@/server/pipeline/queue';
import { getRunEvents, getRun, getRunSessions } from '@/server/queries/pipeline-runs';
import { buildParamsSchema, discoveryParamsSchema, productAgentParamsSchema, type BuildParams } from '@/server/validation/pipeline-runs';

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

// A build queued with `from: 'release'` — the Publish button on a bet whose
// build already ran with a deferred backend — starts from a bet past `ready`.
const RELEASE_BET_STATUS: readonly string[] = ['building', 'testing', 'in_review', 'deployed', 'scaling'];

async function queueRun(kind: PipelineRunKind, formData: FormData): Promise<RunActionState> {
  const user = await requireUser();
  const betId = String(formData.get('betId') ?? '');

  if (!betId) return { error: 'Missing bet reference.' };

  const schema = kind === 'build' ? buildParamsSchema : productAgentParamsSchema;
  const parsed = schema.safeParse({
    publishLegal: formData.get('publishLegal'),
    createFeatures: formData.get('createFeatures'),
    externalRunId: formData.get('externalRunId') || undefined,
    force: formData.get('force'),
    deployTarget: formData.get('deployTarget') || undefined,
    from: formData.get('from') || undefined
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Those parameters are not valid.' };
  }

  const buildParams = kind === 'build' ? (parsed.data as BuildParams) : null;

  if (buildParams && !availableDeployTargets.includes(buildParams.deployTarget)) {
    return { error: 'Idion Cloud (VPC) is not available yet. Pick Supabase, or Supabase later.' };
  }

  const [bet] = await db.select({ id: bets.id, slug: bets.slug, status: bets.status }).from(bets).where(eq(bets.id, betId)).limit(1);

  if (!bet) return { error: 'That bet no longer exists.' };

  const releaseOnly = buildParams?.from === 'release';
  const allowed = releaseOnly ? RELEASE_BET_STATUS : ALLOWED_BET_STATUS[kind];

  if (!allowed.includes(bet.status)) {
    return {
      error: releaseOnly
        ? `This bet is "${bet.status}". Publishing needs a finished build.`
        : kind === 'build'
          ? `This bet is "${bet.status}". A build runs from "ready" — publish a product first.`
          : `This bet is "${bet.status}". Move it back to the backlog to run the product agent again.`
    };
  }

  if (releaseOnly) {
    const [deployment] = await db.select().from(appDeployments).where(eq(appDeployments.betId, bet.id)).limit(1);
    if (!deployment?.supabaseUrl || !deployment.supabaseAnonKey) {
      return { error: 'Enter the Supabase URL and anon key in the Backend card first — the app needs a backend to ship.' };
    }
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

    // The app's deployment row carries the target from the first build on, so
    // the Backend card knows whether to offer the "I did it myself" form.
    if (buildParams && !releaseOnly) {
      await db
        .insert(appDeployments)
        .values({ betId: bet.id, deployTarget: buildParams.deployTarget })
        .onConflictDoUpdate({ target: appDeployments.betId, set: { deployTarget: buildParams.deployTarget, updatedAt: new Date() } });
    }

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
 * Stop — the only thing a human does to a run after starting it. There is no
 * resume button anywhere: a paused run continues by itself on the next free
 * account (server/pipeline/queue.ts), and stopping is how a human says "no".
 *
 * A queued or paused run is cancelled outright, in one statement that also
 * lets go of anything it held. A running one is flagged: the orchestrator sees
 * it on its next heartbeat (60 s at most), asks the agent to stop at a safe
 * point, kills it after a grace period, and completes the run as cancelled.
 */
export async function stopRun(formData: FormData): Promise<RunActionState> {
  const user = await requireUser();
  const runId = String(formData.get('runId') ?? '');
  if (!runId) return { error: 'Missing run reference.' };

  const run = await getRun(runId);
  if (!run) return { error: 'That run no longer exists.' };
  if (isTerminalPipelineRunStatus(run.status)) return { error: `That run already finished (${run.status}).` };

  const outcome = await stopRunInQueue(runId);

  if (outcome === 'missing') return { error: 'That run no longer exists.' };
  if (outcome === 'finished') return { error: 'That run finished while you were looking at it.' };

  await db.insert(pipelineRunEvents).values({
    runId,
    level: 'warn',
    message:
      outcome === 'cancelled'
        ? `Stopped by ${user.name} (it was ${run.status}); nothing was running.`
        : `Stop requested by ${user.name}. The orchestrator stops the agent within a minute.`
  });

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

  let created: { id: string };
  try {
    [created] = await db
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
  } catch (error) {
    // The check above and this insert are two statements; a second admin can
    // queue in between. The index is what decides, and this says so.
    if (isUniqueViolation(error)) return { error: 'A run of this kind is already in flight for this bet.' };
    throw error;
  }

  await db.insert(pipelineRunEvents).values({ runId: created.id, level: 'info', message: `Run again by ${user.name} from run ${runId}.` });
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

  const [run, events, sessions] = await Promise.all([getRun(runId), getRunEvents(runId, sinceIso), getRunSessions(runId)]);
  if (!run) return null;

  return {
    status: run.status,
    sessionCount: run.sessionCount,
    pausedReason: run.status === 'paused' ? run.blockedReason : null,
    retryAfter: run.retryAfter?.toISOString() ?? null,
    progress: run.progress,
    error: run.error,
    attempt: run.attempt,
    runnerId: run.runnerId,
    sessions: sessions.map((session) => ({
      id: session.id,
      seq: session.seq,
      accountLabel: session.accountLabel,
      runnerId: session.runnerId,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      endReason: session.endReason,
      usage: session.usage
    })),
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

// ---------------------------------------------------------------------------
// Backend & Release card
// ---------------------------------------------------------------------------

const backendFormSchema = z.object({
  supabaseUrl: z.url('Enter the project URL, for example https://abcd.supabase.co').max(300),
  supabaseAnonKey: z.string().trim().min(20, 'Paste the anon / publishable key.').max(2000),
  supabaseProjectRef: z
    .string()
    .trim()
    .max(60)
    .regex(/^[a-z0-9]*$/, 'Letters and digits only.')
    .optional()
    .transform((value) => value || undefined)
});

/**
 * "I deployed Supabase myself": the human half of a `deferred` build. Stores
 * the URL and key on the app's deployment row, where the release stage reads
 * them. Queuing the release is a separate click (Publish), which is a trigger.
 */
export async function saveBackend(_state: RunActionState, formData: FormData): Promise<RunActionState> {
  const user = await requireUser();
  const betId = String(formData.get('betId') ?? '');
  if (!betId) return { error: 'Missing bet reference.' };

  const parsed = backendFormSchema.safeParse({
    supabaseUrl: formData.get('supabaseUrl'),
    supabaseAnonKey: formData.get('supabaseAnonKey'),
    supabaseProjectRef: formData.get('supabaseProjectRef') || undefined
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Those values are not valid.' };

  const [bet] = await db.select({ id: bets.id, slug: bets.slug }).from(bets).where(eq(bets.id, betId)).limit(1);
  if (!bet) return { error: 'That bet no longer exists.' };

  const values = {
    supabaseUrl: parsed.data.supabaseUrl,
    supabaseAnonKey: parsed.data.supabaseAnonKey,
    supabaseProjectRef: parsed.data.supabaseProjectRef ?? null,
    updatedAt: new Date()
  };

  await db
    .insert(appDeployments)
    .values({ betId: bet.id, deployTarget: 'deferred', ...values })
    .onConflictDoUpdate({ target: appDeployments.betId, set: values });

  await recordAudit({ actorId: user.id, entity: 'bet', entityId: bet.id, action: 'update', diff: { backend: { from: null, to: parsed.data.supabaseUrl } } });

  revalidatePath(`/internal/bets/${bet.slug}`);
  return { ok: true };
}

/** Publish to the App Store: a build that starts at the release stage. */
export async function publishApp(_state: RunActionState, formData: FormData): Promise<RunActionState> {
  formData.set('from', 'release');
  if (!formData.get('deployTarget')) formData.set('deployTarget', 'deferred');
  return queueRun('build', formData);
}
