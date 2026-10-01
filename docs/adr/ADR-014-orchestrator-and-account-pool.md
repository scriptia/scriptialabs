# ADR-014 — One orchestrator, an account pool, and runs that pause instead of failing

**Status:** accepted
**Amends:** ADR-010 (internal panel: pipeline runs), ADR-011 (runner API)

## Context

Each agent had its own runner. product-agent and builder-agent each polled
`/api/runs/claim` with a near-copy of the same loop; nothing claimed discovery runs
at all. All of them ran `claude -p` on whichever subscription was logged in on the
laptop, and a 5-hour or weekly limit meant hours of sleep (builder), a failed run and
a spent attempt (product), or a stopped hunt (discovery).

The queue itself had four holes:

- the lease was checked by one statement and written by another, so a runner whose
  lease had just been handed to another machine could still overwrite it;
- every claim counted as an attempt, quota blocks included;
- a Stop pressed while a runner was dying was lost when the reaper re-queued the run;
- nothing in the database enforced one discovery run at a time.

## Decision

**One orchestrator per machine** (`idion-orchestrator`, Python, stdlib) claims every
kind of run. Agents stay in their own repos and stay runnable by hand; they share a
small vendored kit (`idion_kit`) for resumable Claude sessions and the exit contract.

**A claim takes a run and an account together.** `provider_accounts` is a pool per
provider (claude, eas, supabase, apple), secrets sealed with `ACCOUNT_VAULT_KEY`.
`POST /api/runs/claim` with `protocol: 2` is one SQL statement (writable CTEs — the
neon-http driver has no interactive transactions) that locks a run and a free Claude
account `FOR UPDATE SKIP LOCKED`, issues a fresh `lease_token`, bumps
`session_count`, and inserts the `account_leases` and `run_sessions` rows. No free
account → no claim; the 204 says so in `X-Idle-Reason` / `X-Next-Account-At`.

**Every runner write is fenced** on `lease_token` (and an unexpired lease) inside the
same statement (`server/pipeline/lease.ts`). A stale token matches zero rows → 409 →
the orchestrator kills that agent.

**A limit pauses, never fails.** `paused` is a stored status. `POST
/api/runs/[id]/pause` marks the account limited until its reset, releases every lease,
closes the session and stores the checkpoint the orchestrator uploaded (parts in
private Vercel Blob). Paused runs are claimable at once and go first; the next claim
with a free account — any machine — restores the checkpoint and resumes the same
Claude conversation (`--resume`, transcripts travel in the checkpoint). The board
shows `Paused ×N`, N = sessions used. Nobody presses resume: the only human actions on
a run are starting it and stopping it.

**`attempt` counts lapsed leases only.** The reaper increments it; claims do not.
The reaper also honours a pending Stop (→ `cancelled`) and sends a run with a
checkpoint back to `paused`, not `queued`.

**Builds deploy and release.** A build has a deploy target: `supabase` (the
orchestrator provisions from the Supabase pool), `deferred` (a human deploys it and
enters URL + key in the Backend card, then presses Publish — a new trigger), or `vpc`
(Idion Cloud, designed behind the same interface, refused until it exists). The build
ends with `eas build --auto-submit` from the EAS pool and a Fastlane listing upload;
submitting for review stays human. Switching EAS accounts bumps the patch version and
re-links the projectId; `app_deployments` records it, with optimistic concurrency on
the version.

## Consequences

- Rotating subscriptions is a product decision with a known terms-of-service risk;
  `credential_type` keeps the door open for API keys without a schema change.
- The queue's correctness now lives in SQL, so it is tested against Postgres itself:
  `npm run test:queue` (see `tests/queue/queue.test.ts`) races 50 claims for 2
  accounts, 20 claims for one discovery slot, and exercises every fenced transition.
- Legacy runners keep working (`protocol` absent → the old claim, fenced by
  `runner_id`, never handed paused runs) until they are retired.
- Schema changes are additive and applied with `npm run db:push` as before.
