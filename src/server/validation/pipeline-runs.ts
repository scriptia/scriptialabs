import { z } from 'zod';

import { pipelineRunEventLevels, pipelineRunKinds } from '@/content/internal';

// Validated at both edges: the panel form that enqueues a run, and the runner
// callbacks that report on it. Same schema for both so the parameters a human
// picked and the parameters the runner receives cannot drift.

// FormData checkboxes arrive as `'on'` or are absent entirely, so a plain
// z.boolean() rejects every form submission. z.coerce.boolean() maps absent ->
// false and any non-empty string -> true, which is exactly the checkbox contract.
const formBoolean = z.coerce.boolean();

// product-agent's own run id: the ISO week by default ("2026-W34"), and the name
// of the directory its artifacts land in. Constrained to what is safe in a path
// because the runner uses it to build one.
const externalRunIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'Use letters, digits, dot, dash or underscore.');

export const productAgentParamsSchema = z.object({
  // On by default. Off still runs the `legal` stage — the App Store record needs
  // those documents either way — but the publish payload omits them, so the page
  // ships without legal links and `legal.hosted` stays false.
  publishLegal: formBoolean.default(true),
  // Off drops the features-plan and features-write stages. The judge stage is
  // told so explicitly, otherwise it fails the run for missing traceability and
  // nothing ever publishes.
  createFeatures: formBoolean.default(true),
  externalRunId: externalRunIdSchema.optional(),
  // Re-run stages already marked done in the run directory's state.json.
  force: formBoolean.default(false),
  // Restrict to specific stages. Empty/absent means all of them.
  stages: z.array(z.string().trim().min(1).max(40)).max(12).optional()
});

export const discoveryParamsSchema = z.object({
  // 'new'    -> the runner picks the next FREE run id and starts a fresh hunt.
  // 'resume' -> re-enter an existing run, re-running whatever is not `succeeded`
  //             (an unjudged slate, a publish that hit a quota).
  mode: z.enum(['new', 'resume']).default('new'),
  // Required for resume; ignored for new, where the runner chooses.
  externalRunId: externalRunIdSchema.optional(),
  // Comma-separated seeds. Empty means take the next markets off the roster cursor.
  markets: z.string().trim().max(400).optional(),
  marketsCount: z.coerce.number().int().min(1).max(6).optional(),
  maxParallel: z.coerce.number().int().min(1).max(6).optional(),
  // Stop launching new sessions once the run passes this. 0 = no ceiling.
  budgetUsd: z.coerce.number().min(0).max(500).optional()
});

export type DiscoveryParams = z.infer<typeof discoveryParamsSchema>;

export const buildParamsSchema = z.object({
  externalRunId: externalRunIdSchema.optional(),
  force: formBoolean.default(false)
});

export type ProductAgentParams = z.infer<typeof productAgentParamsSchema>;
export type BuildParams = z.infer<typeof buildParamsSchema>;

export const pipelineRunParamsSchemaByKind = {
  discovery: discoveryParamsSchema,
  'product-agent': productAgentParamsSchema,
  build: buildParamsSchema
} as const;

// ---------------------------------------------------------------------------
// Runner callbacks
// ---------------------------------------------------------------------------

// Identifies the process holding the lease. Every callback carries it and every
// callback rejects a mismatch, which is what stops a reaped run's original
// process waking up and reporting on work that was handed to someone else.
const runnerIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

export const claimRequestSchema = z.object({
  runnerId: runnerIdSchema,
  kinds: z.array(z.enum(pipelineRunKinds)).min(1).max(pipelineRunKinds.length),
  // 15 minutes by default. Long enough that a slow stage does not lose the lease
  // between heartbeats, short enough that a dead laptop frees the bet the same
  // morning rather than the next day.
  leaseSeconds: z.number().int().min(60).max(3600).default(900)
});

export const heartbeatRequestSchema = z.object({
  runnerId: runnerIdSchema,
  stage: z.string().trim().max(40).optional(),
  stageIndex: z.number().int().min(0).max(100).optional(),
  stageCount: z.number().int().min(0).max(100).optional(),
  note: z.string().trim().max(500).optional(),
  externalRunId: externalRunIdSchema.optional(),
  leaseSeconds: z.number().int().min(60).max(3600).optional()
});

export const runEventSchema = z.object({
  at: z.iso.datetime().optional(),
  level: z.enum(pipelineRunEventLevels).default('info'),
  stage: z.string().trim().max(40).optional(),
  message: z.string().trim().min(1).max(4000),
  data: z.record(z.string(), z.unknown()).nullish()
});

export const eventsRequestSchema = z.object({
  runnerId: runnerIdSchema,
  // Batched by the runner (50 lines / 10s). Bounded so a runaway log cannot
  // write unbounded rows in one call.
  events: z.array(runEventSchema).min(1).max(100)
});

export const completeRequestSchema = z.object({
  runnerId: runnerIdSchema,
  // Outcomes a runner can assert. `expired` is the reaper's alone, and
  // `queued`/`claimed`/`running` are not conclusions.
  //
  // `blocked` says: a Claude usage or spend limit ended the session, so NOTHING
  // was measured and no conclusion about the work is available. The route puts
  // the run back in the queue behind `retryAfter` rather than finishing it.
  status: z.enum(['succeeded', 'failed', 'cancelled', 'blocked']),
  // Epoch seconds from the CLI's rate_limit_event, when status is `blocked`.
  retryAfterEpoch: z.number().int().positive().optional(),
  error: z.string().trim().max(8000).optional(),
  result: z.record(z.string(), z.unknown()).nullish(),
  externalRunId: externalRunIdSchema.optional(),
  logUrl: z.url().max(500).optional()
});

export type ClaimRequest = z.infer<typeof claimRequestSchema>;
export type HeartbeatRequest = z.infer<typeof heartbeatRequestSchema>;
export type EventsRequest = z.infer<typeof eventsRequestSchema>;
export type CompleteRequest = z.infer<typeof completeRequestSchema>;
