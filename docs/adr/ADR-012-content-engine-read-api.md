# ADR-012: A read API surface for the Content Engine

## Status

Accepted.

## Context

[ADR-010](ADR-010-internal-panel.md) built the internal panel on Server Components and
Server Actions exclusively — no API routes, no client-side data fetching. [ADR-011](ADR-011-ingest-api.md)
carved out exactly one exception, `POST /api/ingest/bets`, because the discovery pipeline is
a Python process outside the browser and cannot invoke a Server Action. It closed with an
explicit warning: *"a second route should force a re-reading of ADR-010 rather than being
waved through by pointing at this one."* This ADR is that re-reading.

The Content Engine — ported from a separate Python/FastAPI/SQLAlchemy repo
(`b2c-content-agent`; schema landed in commit `6ee8abd`) — is not one more route. Its
reasoning layer is a set of Claude Code **Skills** (`strategist`, `scriptwriter`,
`video-production`, `knowledge-update`, and others), each an independent process outside the
browser that calls the data layer as an HTTP client, plus **BRAND-AGENT**, an external service
onboarding new apps. Neither can hold a session cookie, and — same as the ingest pipeline —
neither has a stable, documented way to invoke a Server Action from outside Next.js.

This is the same shape of problem ADR-011 solved, at the scale of a whole subsystem rather
than one endpoint: not "the panel needs to read this data" (it doesn't yet — no
`/internal/content-engine/*` pages exist), but "processes outside the browser need a real
HTTP contract for it."

## Decision

**A read-only API surface under `/api/content-engine/*`**, one route per resource
(`apps`, `knowledge`, `trend-sources` (+ `/:id`), `content-pieces` (+ `/performance-summary`),
`publications`, `gallery`) — every route a thin wrapper that parses query parameters and
delegates to a pure data-access function. `GET /api/content-engine/skills` is deliberately
**not** included yet — see "Open question" below.

### 1. Two layers, so the panel never has to call its own API

`src/server/content-engine/*.ts` holds the actual data-access functions (`getApps`,
`getKnowledgeEntries`, `getPerformanceSummary`, ...) — plain `async` functions over Drizzle,
`import 'server-only'`, same shape as `src/server/queries/bets.ts`. The route handlers in
`src/app/api/content-engine/*/route.ts` do nothing but auth, parse, and call one of these.

This split exists so that when `/internal/content-engine/*` pages are built (next phase),
they import from `src/server/content-engine/` directly, the same way the bet pages import
from `src/server/queries/bets.ts` — never a `fetch('/api/content-engine/...')` from a Server
Component. The API surface is for Skills and BRAND-AGENT; the panel does not eat its own
dog food through an HTTP round trip it doesn't need.

### 2. Authentication is a shared bearer token, generalized from ADR-011

`CONTENT_ENGINE_API_TOKEN`, checked with the same `timingSafeEqual`-over-SHA-256 comparison
ADR-011 established, factored into `src/server/auth/api-token.ts` so every route in this
surface (and, if it ever needs one, the ingest route) can share it instead of re-implementing
the comparison. An unset token answers 503, not 401 — same reasoning as ADR-011: a missing
env var is a deployment error, not a wrong caller.

This matters more here than it did for ingest: `src/middleware.ts`'s matcher excludes `/api`
entirely, so these routes get **no** protection from `/internal`'s session guard — there is
no "inherits the panel's auth" to fall back on. Skipping the bearer check would make this
data (brand strategy, knowledge base, unpublished content) unauthenticated at a guessable URL.

### 3. Read-only, on purpose, for now

Every route in this ADR is `GET`. Skills and BRAND-AGENT do need to write eventually
(`POST /content-pieces`, `PATCH /trend-sources/:id/formula`, `POST /knowledge`, and more,
per the original API) — that is deliberately a later phase, once the read surface has proven
the two-layer pattern out. Read-only also means a leaked `CONTENT_ENGINE_API_TOKEN` can only
exfiltrate data, not mutate it, the same safety property ADR-011 called out for `INGEST_TOKEN`.

### 4. Query parameters are validated with zod, not hand-parsed

`src/server/validation/content-engine.ts` mirrors `src/server/validation/ingest.ts`:
`z.uuid()` for id-shaped filters, `z.coerce.number()` for numeric ones (query strings are
always strings), and a `422` with `error.issues` on failure — the same status and shape
`POST /api/ingest/bets` already uses for a bad payload.

## Open question: where do the Skills themselves live?

`GET /api/content-engine/skills` — reading `skills/*/SKILL.md` for the dashboard — is **not
implemented in this pass.** `SKILL.md` files currently live in `b2c-content-agent`, a
separate repository; this repo has no `skills/` directory to read from. Whether they get
copied here, kept where they are (in which case this route may not belong in
`scriptialabs` at all — a Vercel deployment cannot read another repo's filesystem), or synced
some other way, is unresolved. `src/server/content-engine/index.ts` documents this gap
inline; implement the route once that placement decision is made, rather than pointing it at
a path that doesn't exist.

## Consequences

- The project's API surface is no longer "exactly one route" (ADR-011's framing) — it is now
  two purpose-scoped surfaces: one machine writer (`ingest`) and one machine reader
  (`content-engine`). Both stay outside the panel's own data flow. A third surface should
  prompt the same re-reading this ADR gave ADR-011.
- `CONTENT_ENGINE_API_TOKEN` is a new required environment variable for any deployment that
  wants Skills/BRAND-AGENT to read this data — absent in `.env.example` means the surface
  fails closed (503), same failure mode as a missing `INGEST_TOKEN`.
- `src/server/content-engine/` becomes the single place Content Engine data-access logic
  lives, ready to be imported by both the API routes today and `/internal/content-engine/*`
  Server Components in the next phase — without duplicating a single query.
