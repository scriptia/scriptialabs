# ADR-011: An ingest API for the discovery pipeline

## Status

Accepted.

## Context

[ADR-010](ADR-010-internal-panel.md) built the internal panel on Server Components and
Server Actions **exclusively — no API routes**. That decision was right for the panel: every
mutation has a logged-in human behind it, actions give type-safe calls without a client
fetch layer, and not having an API meant not having to secure one.

A second system now needs to write bets. `discovery-bets-pipeline` is a Python orchestrator
that runs a weekly research pipeline and ends with a set of evaluated bets: some approved
and ready to pick, some near-misses worth keeping, some discarded. Each approved bet carries
a build prompt — tens of KB of markdown that gets pasted into a fresh coding session.

Until now that output was read out of files by hand. Getting it onto the board meant
retyping a title, a description, and copying a prompt out of a directory.

A Server Action cannot serve this. Actions are invoked through a React client runtime with
an encrypted action id that is a build artefact — there is no stable, documented calling
convention for a process outside the browser, and pretending otherwise would mean an
external system depending on Next.js internals that change between builds.

## Decision

**One API route: `POST /api/ingest/bets`.** It is the entire API surface of the project, and
the panel's own mutations remain server actions with no exceptions.

### 1. Authentication is a single shared bearer token

`INGEST_TOKEN`, compared with `timingSafeEqual` over SHA-256 digests of both sides (hashing
first because `timingSafeEqual` throws on length mismatch, and the supplied length is itself
a small leak).

The panel uses per-user accounts precisely because "who changed this" matters (ADR-010 §3).
That reasoning does not transfer here: there is exactly one machine client, it is not a
person, and the audit rows it writes carry `actorId: null`, which already reads as "the
pipeline did this". A second account system for one caller would be ceremony without safety.

An unset `INGEST_TOKEN` returns **503, not 401** — and never falls open. The distinction is
deliberate: 503 means the deployment is not configured, 401 means the caller is wrong, and
conflating them makes a first deploy hard to debug.

### 2. The pipeline may only write three statuses

`ready`, `backlog`, `killed` — approved, near-miss, discarded. Every later stage
(`researching`, `building`, `deployed`, `scaling`, `paused`) is a human decision made in the
panel.

Further, **an existing bet's status is only overwritten when it currently holds one of those
three**. Once you have moved a card to `building`, the next weekly run refreshes its title,
description and documents but leaves the status alone, and names it in the response's
`statusHeld`. Without this rule, a pipeline that re-pushes its whole ledger every week would
silently reset the board — the failure would look like the panel losing your work.

### 3. Documents are text rows in Postgres, not blobs

`bet_documents` stores the build prompt, spec and memo as `text`, unique on `(bet_id, kind)`
so a re-push replaces rather than accumulates.

ADR-010's future considerations listed "file attachments via Vercel Blob", and for genuine
file uploads that is still right. These are not files in that sense: they are generated
markdown, tens of KB, read far more often than written, and only ever consumed as text by a
copy button. Blob storage would add a service, a token, and a second place the data can go
missing, to solve a problem Postgres does not have. The detail page lists documents without
their bodies and fetches one on demand, so the page payload stays small.

### 4. Writes are idempotent rather than transactional

The `neon-http` driver is one statement per round trip and has no interactive transactions
(`src/server/db/client.ts`). Rather than switch drivers for this one route, every write is
an upsert keyed on `bets.slug` or `(bet_id, kind)`. A partially applied push is repaired by
calling the endpoint again — which the pipeline does on its next run regardless.

## Consequences

- The project has an API surface, and it needs to stay this small. A second route should
  force a re-reading of ADR-010 rather than being waved through by pointing at this one.
- `INGEST_TOKEN` is a bearer secret in an environment variable. It grants exactly the three
  status transitions above and nothing else; there is no read endpoint, so a leaked token
  cannot exfiltrate the ledger.
- `middleware.ts`'s matcher already excludes `/api`, so the route bypasses the session
  redirect with no change. That exclusion is now load-bearing — narrowing it would break
  ingestion with a confusing HTML redirect rather than a clean error.
- The board gains a `ready` column. It exists for the pick queue and is written mostly by a
  machine, which makes it the first column whose contents are not the result of someone
  clicking something.
