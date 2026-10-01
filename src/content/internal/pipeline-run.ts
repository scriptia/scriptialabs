import type { BadgeTone } from '@/components/primitives';

// A pipeline run is one execution of an external agent against one bet (or,
// for discovery, against no bet). The row is the job: the panel enqueues it, an
// orchestrator claims it over HTTP (idion-orchestrator — one per machine,
// several machines at once), and every status transition here is what moves
// the bet through its own lifecycle.
//
// Same storage approach as bet-status.ts: `text` in Postgres with the union
// applied via `$type`, not a PG enum, so adding a kind or a status is one
// content entry rather than an `ALTER TYPE` against live data (ADR-010).

// `product-agent` turns a Bet Case into name, identity, features, legal
// documents and a store package, then publishes them. `build` hands every
// artifact that produced to the builder, deploys the backend (per the run's
// deploy target) and ends with an EAS build auto-submitted to TestFlight plus
// the store metadata uploaded by Fastlane.
export const pipelineRunKinds = ['discovery', 'product-agent', 'build'] as const;

export type PipelineRunKind = (typeof pipelineRunKinds)[number];

export const pipelineRunKindLabels: Record<PipelineRunKind, string> = {
  discovery: 'Discovery',
  'product-agent': 'Product agent',
  build: 'Build'
};

// The bet status each kind drives the bet into when its run is claimed. Keeping
// this next to the kinds means the claim route never hardcodes a status, and
// adding a kind forces you to decide what it does to the board.
// null = claiming this kind moves nothing on the board.
// Discovery hunts markets and produces bets; it has no bet to move.
// A product-agent run has a bet but deliberately leaves it in `backlog`: the
// publish is what promotes it to `ready`, and a stage for "currently running"
// was a column nobody worked in (see bet-status.ts). The run is visible on the
// bet's Pipeline tab while it works.
export const pipelineRunKindClaimStatus = {
  discovery: null,
  'product-agent': null,
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
//
// `paused` is NOT a failure and NOT a human state. A session ended on an account
// limit (a Claude 5-hour or weekly window, an EAS build quota), the orchestrator
// saved a checkpoint, and the run waits to be claimed again with a different
// account from the pool — on any machine. Nobody resumes it: the next claim that
// finds a free account does. The panel shows it as "Paused ×N", N being the
// number of sessions the run has used so far (`session_count`). A human can only
// stop it.
export const pipelineRunStatuses = ['queued', 'claimed', 'running', 'paused', 'succeeded', 'failed', 'cancelled', 'expired'] as const;

export type PipelineRunStatus = (typeof pipelineRunStatuses)[number];

export const pipelineRunStatusLabels: Record<PipelineRunStatus, string> = {
  queued: 'Queued',
  claimed: 'Claimed',
  running: 'Running',
  paused: 'Paused',
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
  paused: 'warning',
  succeeded: 'success',
  failed: 'error',
  cancelled: 'warning',
  expired: 'warning'
};

/** "Paused ×2" — the label the board shows. Every other status is its plain label. */
export function pipelineRunStatusLabel(status: PipelineRunStatus, sessionCount: number): string {
  return status === 'paused' ? `Paused ×${Math.max(1, sessionCount)}` : pipelineRunStatusLabels[status];
}

// Statuses that still hold the queue slot. The partial unique index on
// (betId, kind) is defined over exactly this set, so a second run for the same
// bet and kind is a database error rather than a disabled button — and the
// panel polls for live progress only while a run is in one of these.
export const activePipelineRunStatuses = ['queued', 'claimed', 'running', 'paused'] as const;

// Statuses in which a process holds the lease. Every runner write is fenced on
// one of these plus the run's lease_token (server/pipeline/lease.ts).
export const leasedPipelineRunStatuses = ['claimed', 'running'] as const;

// Statuses the claim query hands out. A paused run is claimable exactly like a
// queued one — that IS the automatic resume.
export const claimablePipelineRunStatuses = ['queued', 'paused'] as const;

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
