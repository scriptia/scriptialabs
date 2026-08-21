import type { BadgeTone } from '@/components/primitives';

// A pipeline run is one execution of an external agent against one bet,
// queued from the panel and claimed over HTTP by a poller on a developer's
// machine (product-agent's orchestrator/runner.py). The row is the job: the
// panel enqueues it, the runner claims it, and every status transition here is
// what moves the bet through its own lifecycle.
//
// Same storage approach as bet-status.ts: `text` in Postgres with the union
// applied via `$type`, not a PG enum, so adding a kind or a status is one
// content entry rather than an `ALTER TYPE` against live data (ADR-010).

// `product-agent` turns a Bet Case into name, identity, features, legal
// documents and a store package, then publishes them. `build` hands every
// artifact that produced to the builder and stops.
export const pipelineRunKinds = ['product-agent', 'build'] as const;

export type PipelineRunKind = (typeof pipelineRunKinds)[number];

export const pipelineRunKindLabels: Record<PipelineRunKind, string> = {
  'product-agent': 'Product agent',
  build: 'Build'
};

// The bet status each kind drives the bet into when its run is claimed. Keeping
// this next to the kinds means the claim route never hardcodes a status, and
// adding a kind forces you to decide what it does to the board.
export const pipelineRunKindClaimStatus = {
  'product-agent': 'researching',
  build: 'building'
} as const;

// `claimed` and `running` are deliberately distinct: a runner claims a job the
// moment it takes the lease, but only reports `running` once the first stage
// has actually started. A run stuck in `claimed` is a runner that died between
// the two, which is a different failure from one that died mid-stage.
//
// `expired` is written by the reaper, never by a runner — it means the lease
// lapsed without a terminal status, so nothing can be concluded about what the
// process did.
export const pipelineRunStatuses = ['queued', 'claimed', 'running', 'succeeded', 'failed', 'cancelled', 'expired'] as const;

export type PipelineRunStatus = (typeof pipelineRunStatuses)[number];

export const pipelineRunStatusLabels: Record<PipelineRunStatus, string> = {
  queued: 'Queued',
  claimed: 'Claimed',
  running: 'Running',
  succeeded: 'Succeeded',
  failed: 'Failed',
  cancelled: 'Cancelled',
  expired: 'Expired'
};

// Same approach as betStatusTones: every status maps to an existing Badge tone,
// so a new status never needs a new component or a new colour token.
export const pipelineRunStatusTones: Record<PipelineRunStatus, BadgeTone> = {
  queued: 'neutral',
  claimed: 'brand',
  running: 'brand',
  succeeded: 'success',
  failed: 'error',
  cancelled: 'warning',
  expired: 'warning'
};

// Statuses that still hold the queue slot. The partial unique index on
// (betId, kind) is defined over exactly this set, so a second run for the same
// bet and kind is a database error rather than a disabled button — and the
// panel polls for live progress only while a run is in one of these.
export const activePipelineRunStatuses = ['queued', 'claimed', 'running'] as const;

// Statuses a run can never leave. The publish route refuses a callback whose
// run has already reached one of these, which is what stops a reaped process
// waking up and publishing a second time.
export const terminalPipelineRunStatuses = ['succeeded', 'failed', 'cancelled', 'expired'] as const;

export function isPipelineRunKind(value: string): value is PipelineRunKind {
  return (pipelineRunKinds as readonly string[]).includes(value);
}

export function isPipelineRunStatus(value: string): value is PipelineRunStatus {
  return (pipelineRunStatuses as readonly string[]).includes(value);
}

export function isActivePipelineRunStatus(value: PipelineRunStatus): boolean {
  return (activePipelineRunStatuses as readonly PipelineRunStatus[]).includes(value);
}

export function isTerminalPipelineRunStatus(value: PipelineRunStatus): boolean {
  return (terminalPipelineRunStatuses as readonly PipelineRunStatus[]).includes(value);
}

// Levels for the run timeline the panel renders from pipeline_run_events.
export const pipelineRunEventLevels = ['info', 'warn', 'error'] as const;

export type PipelineRunEventLevel = (typeof pipelineRunEventLevels)[number];

export const pipelineRunEventLevelTones: Record<PipelineRunEventLevel, BadgeTone> = {
  info: 'neutral',
  warn: 'warning',
  error: 'error'
};
