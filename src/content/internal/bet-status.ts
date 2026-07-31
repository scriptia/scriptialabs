import type { BadgeTone } from '@/components/primitives';

// The lifecycle a bet moves through. Deliberately stored as `text` in Postgres
// rather than a PG enum (see ADR-010) — adding a stage is a one-line change
// here plus a label/tone entry, not an `ALTER TYPE` migration against live data.
// `ready` is the pick queue: bets the discovery pipeline has evaluated and
// approved, waiting for a human to choose one. It sits after `backlog` because
// reaching it is a promotion out of the backlog, not an entry point.
export const betStatuses = ['backlog', 'ready', 'researching', 'building', 'in_review', 'deployed', 'scaling', 'paused', 'killed'] as const;

export type BetStatus = (typeof betStatuses)[number];

export const betStatusLabels: Record<BetStatus, string> = {
  backlog: 'Backlog',
  ready: 'Ready',
  researching: 'Researching',
  building: 'Building',
  in_review: 'In Review',
  deployed: 'Deployed',
  scaling: 'Scaling',
  paused: 'Paused',
  killed: 'Killed'
};

// Same approach as `toneByStatus` in components/data/product-status-badge.tsx:
// every status maps to an existing Badge tone, so a new status never needs a
// new component or a new colour token.
export const betStatusTones: Record<BetStatus, BadgeTone> = {
  backlog: 'neutral',
  ready: 'brand',
  researching: 'neutral',
  building: 'brand',
  in_review: 'brand',
  deployed: 'success',
  scaling: 'success',
  paused: 'warning',
  killed: 'error'
};

// Statuses that represent a bet that is no longer being actively worked on.
// Used to keep the board's "dead columns" collapsed and to exclude them from
// the dashboard's stale-bet check.
export const dormantBetStatuses: readonly BetStatus[] = ['paused', 'killed'];

export function isBetStatus(value: string): value is BetStatus {
  return (betStatuses as readonly string[]).includes(value);
}

export const betAudiences = ['b2c', 'b2b', 'internal'] as const;
export type BetAudience = (typeof betAudiences)[number];

export const betAudienceLabels: Record<BetAudience, string> = {
  b2c: 'B2C',
  b2b: 'B2B',
  internal: 'Internal'
};

export function isBetAudience(value: string): value is BetAudience {
  return (betAudiences as readonly string[]).includes(value);
}

export const betPriorities = ['low', 'medium', 'high'] as const;
export type BetPriority = (typeof betPriorities)[number];

export const betPriorityLabels: Record<BetPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High'
};

export const betPriorityTones: Record<BetPriority, BadgeTone> = {
  low: 'neutral',
  medium: 'brand',
  high: 'warning'
};

export function isBetPriority(value: string): value is BetPriority {
  return (betPriorities as readonly string[]).includes(value);
}
