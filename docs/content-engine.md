# Content Engine

## What this is

A data layer and read/write HTTP API — `src/server/content-engine/` and `src/app/api/content-engine/*` — for the **Content Engine**: the system that generates and tracks viral content for Padelco (and future apps), migrated from a standalone Python/FastAPI/SQLAlchemy prototype (`b2c-content-agent`). Its reasoning has always lived outside the database layer, in **Claude Code Skills** (`skills/*/SKILL.md` in this repo — `strategist`, `scriptwriter`, `video-production`, `carousel-production`, `feedback-collection`, `knowledge-update`, `orchestrator`, `trend-analysis`) — this migration ports the schema and the API contract those Skills call, not the reasoning itself.

**BRAND-AGENT**, a separate service on another team that provisions new apps into the system, is the other consumer — it has its own endpoint and its own token (see below).

## Requirements for this to actually work

- **`npm run db:push` run against the real Neon database.** This has not happened yet as of this branch — every verification in its commit history was done against an ephemeral local Postgres (see each commit message). Before relying on this in a real environment, run `db:push` with `DATABASE_URL` pointing at Neon, then confirm with `npm run db:studio` or `psql`/`\dt` that all 18 tables exist: the 8 already there from the internal panel (`users`, `bets`, `bet_links`, `bet_documents`, `bet_updates`, `bet_metrics`, `bet_tasks`, `audit_log`) plus the 10 new ones (`apps`, `trend_sources`, `content_pieces`, `content_assets`, `gallery_items`, `knowledge_entries`, `publications`, `social_metrics`, `agent_runs`, `integration_configs`).
- **Two new environment variables**, both bearer secrets checked the same way `INGEST_TOKEN` is (see [ADR-011](adr/ADR-011-ingest-api.md)) — generate each with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`, and see `.env.example` for the exact names:
  - `CONTENT_ENGINE_API_TOKEN` — required by every route except `/apps/onboard`. This is what the 8 Skills authenticate with.
  - `BRAND_AGENT_API_TOKEN` — required only by `POST /apps/onboard`. Kept deliberately separate from `CONTENT_ENGINE_API_TOKEN`: BRAND-AGENT and the Skills are distinct external consumers with distinct lifecycles, and rotating one token should never force rotating the other.
  - Either one left unset makes the routes it guards answer `503`, not `401` — a missing token is a deployment error, not a wrong caller, same distinction the ingest route already draws.
- **Twelve Labs, Kling, and Shotstack are never called from this backend.** See [ADR-012](adr/ADR-012-content-engine-read-api.md) for the full reasoning — in short, there is no `ProducerAgent`-equivalent executor here. A Skill calls those APIs itself, directly, from outside this process, and only hands this backend the finished result (a real url) to persist. Two endpoints carry this caveat explicitly: `POST /trend-sources/from-link` (registers a link but doesn't transcribe/analyze it — Twelve Labs) and `POST /content/:id/produce` (persists an already-produced asset but doesn't generate or assemble it — Kling/Shotstack). Passing a generation prompt to either is rejected by validation, not silently accepted.

## Architecture

Same two-layer split introduced for the bet-tracking panel's own reads (`src/server/queries/bets.ts`), applied here for a different reason:

- **`src/server/content-engine/*.ts`** — the only place that touches the database for this domain. Plain `async` functions over Drizzle, `import 'server-only'`, one file per resource (`apps.ts`, `knowledge.ts`, `trend-sources.ts`, `content-pieces.ts`, `publications.ts`, `gallery.ts`, `production.ts`).
- **`src/app/api/content-engine/*/route.ts`** — thin HTTP wrappers: parse (zod, `src/server/validation/content-engine.ts`), authenticate, delegate to the function above, shape the response.

[ADR-010](adr/ADR-010-internal-panel.md) built this repository's first backend on Server Components and Server Actions **exclusively — no API routes**. [ADR-011](adr/ADR-011-ingest-api.md) carved out one deliberate exception for a process outside the browser. [ADR-012](adr/ADR-012-content-engine-read-api.md) is why this whole domain gets a real HTTP surface instead of following ADR-010's default: the 8 Skills and BRAND-AGENT are all processes outside the browser, same shape of problem as the ingest route, at the scale of a subsystem rather than one endpoint. When `/internal/content-engine/*` pages get built (not yet — no pages exist), they're expected to import `src/server/content-engine/` directly, the same way the bet pages import `src/server/queries/bets.ts`, never `fetch()` this API from a Server Component.

## Endpoint inventory

Base URL: `${CONTENT_ENGINE_API_BASE}` (Skills' own env var, not read by this app — default `http://localhost:3000` in dev). Every request needs `Authorization: Bearer <token>` — `CONTENT_ENGINE_API_TOKEN` except where noted.

| Method | Route | For | Status |
| --- | --- | --- | --- |
| GET | `/api/content-engine/apps` | orchestrator, strategist, scriptwriter | ✅ real |
| POST | `/api/content-engine/apps/onboard` | BRAND-AGENT (`BRAND_AGENT_API_TOKEN`) | ✅ real |
| GET | `/api/content-engine/knowledge` | strategist, scriptwriter, knowledge-update | ✅ real |
| POST | `/api/content-engine/knowledge` | knowledge-update | ✅ real |
| GET | `/api/content-engine/trend-sources` | strategist, knowledge-update, trend-analysis | ✅ real |
| GET | `/api/content-engine/trend-sources/:id` | scriptwriter, trend-analysis | ✅ real |
| POST | `/api/content-engine/trend-sources/from-link` | trend-analysis, orchestrator | ⚠️ real, with caveat — no Twelve Labs call; `transcript`/`sceneBreakdown` stay empty |
| PATCH | `/api/content-engine/trend-sources/:id/formula` | trend-analysis | ✅ real (plain overwrite, no version chain — see the function's own comment for why) |
| GET | `/api/content-engine/content-pieces` | strategist | ✅ real |
| POST | `/api/content-engine/content-pieces` | scriptwriter | ✅ real |
| GET | `/api/content-engine/content-pieces/performance-summary` | strategist, knowledge-update, orchestrator | ✅ real |
| POST | `/api/content-engine/content-pieces/:id/publish` | feedback-collection | ✅ real |
| GET | `/api/content-engine/content/review-queue` | video-production, carousel-production | ✅ real |
| POST | `/api/content-engine/content/:id/produce` | video-production, carousel-production | ⚠️ real, with caveat — accepts an already-produced url (`asset`/`slideAssets`), never a generation prompt; no Kling/Shotstack call. Returns `409` if the piece isn't `"scripted"` (already produced once) |
| GET | `/api/content-engine/gallery` | (general listing) | ✅ real |
| GET | `/api/content-engine/gallery/search` | video-production, carousel-production | ✅ real (keyword match over `description`+`tags`, no embeddings) |
| GET | `/api/content-engine/publications` | feedback-collection, orchestrator | ✅ real |
| POST | `/api/content-engine/publications/:id/social-metrics` | feedback-collection | ✅ real (always inserts a new snapshot, never updates one) |
| GET | `/api/content-engine/skills` | (future dashboard) | ❌ not implemented — see below |

## What's missing (Fase 4, known)

- **`GET /api/content-engine/skills` doesn't exist.** Blocked on an undecided question: whether `skills/*/SKILL.md` stays copied into this repo long-term (as it is right now) or moves/syncs some other way. Building the endpoint before that's decided risks pointing it at the wrong home. See `src/server/content-engine/index.ts` and [ADR-012](adr/ADR-012-content-engine-read-api.md).
- **No automated tests.** Everything in this migration was verified manually — `curl` against a real (ephemeral, local Docker) Postgres, per commit. `tests/` has no runner wired up for the rest of the repo either (see [roadmap.md](roadmap.md)), so this isn't a new gap, but it's a real one this migration inherits and adds surface area to.
- **Twelve Labs is not connected anywhere in this backend** — `POST /trend-sources/from-link` registers a link without transcribing or analyzing it (see the caveat in the table above). `trend-analysis` cannot do its actual job against this API alone yet.

## Verifying it's alive after `db:push`

Three calls — enough to confirm auth, the database connection, and a write all work; not the full ~40-command verification pass each commit in this branch's history actually ran.

```bash
# 1. Auth + DB connectivity — should return [] or existing apps, not a 401/500
curl -s -H "Authorization: Bearer $CONTENT_ENGINE_API_TOKEN" \
  "$CONTENT_ENGINE_API_BASE/api/content-engine/apps"

# 2. A real write — replace <app-id> with an id from step 1 (or onboard one first)
curl -s -X POST -H "Authorization: Bearer $CONTENT_ENGINE_API_TOKEN" -H "Content-Type: application/json" \
  -d '{"app_id":"<app-id>","content_type":"reel","angle":"test","hook_type":"test"}' \
  "$CONTENT_ENGINE_API_BASE/api/content-engine/content-pieces"

# 3. Read it back — should list the piece just created, status "scripted"
curl -s -H "Authorization: Bearer $CONTENT_ENGINE_API_TOKEN" \
  "$CONTENT_ENGINE_API_BASE/api/content-engine/content-pieces?app_id=<app-id>&days=1"
```

If step 1 returns `503`, `CONTENT_ENGINE_API_TOKEN` isn't set in that environment. If it returns a Neon/connection error, `db:push` likely hasn't run against that database yet.
