import { z } from 'zod';

import { accountProviders, deployTargets, pipelineRunEventLevels, pipelineRunKinds } from '@/content/internal';

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
  force: formBoolean.default(false),
  // Where the backend goes (content/internal/provider-accounts.ts). `vpc` is
  // accepted by the schema so the stored shape is stable, and refused by the
  // action until Idion Cloud exists.
  deployTarget: z.enum(deployTargets).default('supabase'),
  // 'release' = skip straight to the backend check + App Store release, for a
  // bet whose build already finished (the Publish button after a deferred
  // backend was filled in).
  from: z.enum(['start', 'release']).default('start')
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

// The fencing token handed out by a claim. Optional so a legacy runner (which
// never received one) still validates; the fence then falls back to runnerId.
const leaseTokenSchema = z.uuid();

export const claimRequestSchema = z.object({
  runnerId: runnerIdSchema,
  kinds: z.array(z.enum(pipelineRunKinds)).min(1).max(pipelineRunKinds.length),
  // 15 minutes by default. Long enough that a slow stage does not lose the lease
  // between heartbeats, short enough that a dead laptop frees the bet the same
  // morning rather than the next day.
  leaseSeconds: z.number().int().min(60).max(3600).default(900),
  // 2 = idion-orchestrator: claims come with a Claude account from the pool and
  // may hand out paused runs. Absent = a legacy runner.py.
  protocol: z.literal(2).optional(),
  // Machine report, for the Machines section. All optional.
  host: z.string().trim().max(120).optional(),
  version: z.string().trim().max(40).optional(),
  capacity: z.number().int().min(0).max(64).optional(),
  activeRuns: z.number().int().min(0).max(64).optional(),
  tools: z.record(z.string().max(40), z.string().max(120).nullable()).optional()
});

export const heartbeatRequestSchema = z.object({
  runnerId: runnerIdSchema,
  leaseToken: leaseTokenSchema.optional(),
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
  leaseToken: leaseTokenSchema.optional(),
  // Batched by the runner (50 lines / 10s). Bounded so a runaway log cannot
  // write unbounded rows in one call.
  events: z.array(runEventSchema).min(1).max(100)
});

// {inputTokens, outputTokens, costUsd, claudeSessions}, as the orchestrator
// totals a session from usage.jsonl. Stored on the run_sessions row.
const usageSchema = z.record(z.string().max(40), z.union([z.number(), z.string().max(200), z.null()])).nullish();

export const completeRequestSchema = z.object({
  runnerId: runnerIdSchema,
  leaseToken: leaseTokenSchema.optional(),
  usage: usageSchema,
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

// The checkpoint the orchestrator uploaded (one or more Blob parts, each under
// the 4.5 MB function body limit) — see api/runs/[id]/checkpoint.
export const checkpointSchema = z.object({
  parts: z
    .array(z.object({ pathname: z.string().trim().min(1).max(400), bytes: z.number().int().min(0) }))
    .min(1)
    .max(64),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().min(0),
  runnerId: runnerIdSchema,
  sessionSeq: z.number().int().min(0),
  createdAt: z.iso.datetime(),
  // Where the builder pushed its WIP commit, when the agent works in a git repo.
  git: z.object({ repo: z.string().max(300), branch: z.string().max(200), commit: z.string().max(64) }).nullish()
});

export const pauseRequestSchema = z.object({
  runnerId: runnerIdSchema,
  leaseToken: leaseTokenSchema,
  // What ran out, in words: "Claude 5-hour limit", "EAS build quota".
  reason: z.string().trim().min(1).max(500),
  // The account that ran out and when it comes back. Omitted when what ran out
  // is not an account (then `resumeAfterEpoch` holds the run instead).
  accountId: z.uuid().optional(),
  limitedUntilEpoch: z.number().int().positive().optional(),
  resumeAfterEpoch: z.number().int().positive().optional(),
  checkpoint: checkpointSchema.nullish(),
  stage: z.string().trim().max(40).optional(),
  stageIndex: z.number().int().min(0).max(100).optional(),
  stageCount: z.number().int().min(0).max(100).optional(),
  usage: usageSchema
});

export const checkpointRecordSchema = z.object({
  runnerId: runnerIdSchema,
  leaseToken: leaseTokenSchema,
  checkpoint: checkpointSchema
});

export const accountLeaseRequestSchema = z.object({
  runnerId: runnerIdSchema,
  leaseToken: leaseTokenSchema,
  runId: z.uuid(),
  provider: z.enum(accountProviders),
  prefer: z.uuid().nullish(),
  exclude: z.array(z.uuid()).max(50).optional(),
  // Read the secret of ONE named account without taking a slot on it, even if it is limited:
  // polling an EAS build that account started, after the build itself used up its quota.
  // Requires `prefer` (the account) and a valid run lease; takes no lease, changes nothing.
  readOnly: z.boolean().optional()
});

export const accountReleaseRequestSchema = z.object({
  runnerId: runnerIdSchema,
  leaseToken: leaseTokenSchema,
  runId: z.uuid(),
  limitedUntilEpoch: z.number().int().positive().optional(),
  reason: z.string().trim().max(500).optional(),
  quota: z.record(z.string().max(40), z.unknown()).optional()
});

export const deploymentReportSchema = z.object({
  runnerId: runnerIdSchema,
  leaseToken: leaseTokenSchema,
  deployTarget: z.enum(deployTargets).optional(),
  bundleId: z.string().trim().max(200).nullish(),
  ascAppId: z.string().trim().max(40).nullish(),
  easAccountId: z.uuid().nullish(),
  easOwner: z.string().trim().max(100).nullish(),
  easProjectId: z.string().trim().max(100).nullish(),
  appVersion: z.string().trim().max(20).nullish(),
  // Optimistic concurrency for the version bump: the write only lands if the
  // stored version is still this one.
  expectedAppVersion: z.string().trim().max(20).nullish(),
  supabaseAccountId: z.uuid().nullish(),
  supabaseProjectRef: z.string().trim().max(60).nullish(),
  supabaseUrl: z.url().max(300).nullish(),
  supabaseAnonKey: z.string().trim().max(2000).nullish(),
  lastBuild: z.record(z.string().max(40), z.unknown()).nullish(),
  ascSubscriptionGroupId: z.string().trim().max(40).nullish(),
  revenuecatProjectId: z.string().trim().max(100).nullish(),
  revenuecatAppId: z.string().trim().max(100).nullish(),
  revenuecatPublicKey: z.string().trim().max(200).nullish(),
  // Plaintext in transit only: the route seals it before it touches the table.
  revenuecatWebhookSecret: z.string().min(16).max(500).nullish(),
  monetizationState: z.record(z.string().max(40), z.unknown()).nullish()
});

export const revenuecatTokenRequestSchema = z.object({
  runnerId: runnerIdSchema,
  leaseToken: leaseTokenSchema,
  runId: z.uuid()
});

export type ClaimRequest = z.infer<typeof claimRequestSchema>;
export type PauseRequest = z.infer<typeof pauseRequestSchema>;
export type CheckpointPayload = z.infer<typeof checkpointSchema>;
export type HeartbeatRequest = z.infer<typeof heartbeatRequestSchema>;
export type EventsRequest = z.infer<typeof eventsRequestSchema>;
export type CompleteRequest = z.infer<typeof completeRequestSchema>;
