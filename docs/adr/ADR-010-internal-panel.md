# ADR-010: Internal panel and the first backend

## Context

Scriptia Labs runs several product bets at once. Until now they were tracked in a
spreadsheet: status, owner, links to Drive materials, TikTok and other social accounts,
repositories. That works until it doesn't — a spreadsheet has no history, no attribution,
no notion of "this bet has not moved in three weeks", and no safe way for several people
to edit it at once.

The repository was, until this change, a **pure marketing site**: statically generated,
no database, no authentication, no API routes, no server actions. Even the contact form
(`src/components/forms/contact-form.tsx`) simulates its submission client-side because
there was nothing to submit to.

So this decision is not only "add a bet tracker". It is the first server-side surface in
the codebase, and it sets the pattern that every future one will follow.

## Decision

An authenticated internal panel at **`/internal`**, backed by **Neon Postgres** through
**Drizzle ORM**, using **Server Components and Server Actions** exclusively — no API
routes, no client-side data fetching.

> **Amended by [ADR-011](ADR-011-ingest-api.md).** "No API routes" still governs everything
> the panel itself does. One route, `POST /api/ingest/bets`, was later added for the
> discovery pipeline — a process outside the browser, which cannot invoke a server action.

Six decisions inside that are worth recording, because each had a plausible alternative.

### 1. The public site keeps zero database dependency

`src/content/products` remains the source of truth for what `scriptialabs.com` shows.
A bet carries an optional `publicSlug` that *points at* a product registry slug, but
nothing reads the database to render a public page.

This is the most important constraint in the design. It means no outage, migration, or
free-tier limit on the database can take the marketing site down, and it keeps every
public route statically generated — confirmed by the build output, where `/[locale]/*`
remain `●` (SSG) and only `/internal/*` are `ƒ` (dynamic).

The alternative — the panel publishing to the site — was rejected for now rather than
forever. It needs EN/ES/CA content editing to be worth anything, which is a much larger
piece of work than bet tracking, and coupling them from day one would mean the public
site inherits the panel's failure modes for no immediate benefit.

### 2. Neon Postgres over Supabase or Turso

Neon is provisioned through the Vercel Marketplace integration, which injects
`DATABASE_URL` automatically and requires no second dashboard. Its `neon-http` driver
speaks HTTP rather than TCP, so serverless functions need no connection pool and hold no
socket open between invocations — the thing that usually breaks Postgres on a
free-tier serverless host.

- **Supabase** bundles auth, storage and a table editor we don't need, adds a second
  place to manage state, and pauses inactive free projects after about a week.
- **Turso/libSQL** is cheaper and faster, but SQLite has no `numeric`, no `jsonb`, and a
  weaker story for the reporting this data will eventually want.

Neon's free tier suspends after ~5 minutes idle, costing roughly half a second on the
first request after a quiet period. For an internal panel that is an acceptable trade.

### 3. Per-user accounts, not a shared password

A single `INTERNAL_PASSWORD` environment variable would have been less code. It was
rejected because it makes the two features the panel exists for meaningless: "who has
this bet right now" degrades to a free-text field, and every edit is anonymous, so the
audit log records nothing worth reading.

Passwords are hashed with **scrypt from `node:crypto`** — no native build step, no extra
dependency — in the format `scrypt$<salt>$<hash>` so the algorithm travels with the hash
and can be migrated later. Sessions are signed JWTs in an HttpOnly cookie, using **jose**
rather than `jsonwebtoken` because the middleware runs on the Edge runtime, which has
WebCrypto but not `node:crypto`.

There is deliberately no signup route. Accounts are created with `npm run seed:user`.

Verification is split in two on purpose: `middleware.ts` checks only the cookie
*signature* (no database call on every request), while `requireUser()` in
`src/server/auth/guard.ts` does the account lookup inside pages and actions, so a
deactivated user loses access immediately rather than when their 7-day token expires.

### 4. `/internal` lives outside the locale tree

Routes are at `src/app/internal/`, a sibling of `src/app/[locale]/`, not inside it.
Next.js resolves static path segments before dynamic ones, so `/internal` wins over
`/[locale]`.

This required changing the middleware from a bare `createMiddleware(routing)` re-export
into a dispatcher. With `localePrefix: 'always'`, letting next-intl see `/internal` would
redirect it to `/en/internal`. The panel is English-only and internal; translating it into
three languages would be pure cost.

**It also surfaced a latent bug.** The middleware lived at the repository root, but this
project keeps `app` under `src/`, and Next.js looks for middleware next to the `app`
directory. The root-level `middleware.ts` had therefore **never executed** — silently, with
no warning. Public routing appeared to work because `src/app/page.tsx` performs its own
redirect to the default locale and `src/app/[locale]/layout.tsx` validates the locale param
itself. Had the panel's guard shipped in that file, `/internal` would have been completely
unauthenticated while looking correct in code review. It now lives at `src/middleware.ts`,
and its presence is verifiable in the build output, which lists `ƒ Middleware` — a line that
was absent before.

### 5. Status is a `text` column, not a Postgres enum

`bets.status`, `bet_links.kind` and friends are `text` columns with a TypeScript union
applied through Drizzle's `$type<>()`, validated at the edge by zod schemas in
`src/server/validation/`. The values themselves live in `src/content/internal/` —
the same place the public product registry's statuses live.

This mirrors `toneByStatus` in `src/components/data/product-status-badge.tsx`: adding a
lifecycle stage is a one-line content change plus a label and a tone, not an
`ALTER TYPE` against live data. Given that this vocabulary is expected to change as the
team learns how it actually works, that flexibility is worth more than the database-level
constraint.

Bet statuses are intentionally a *different* union from the public `ProductStatus`. They
describe internal progress (`backlog → researching → building → deployed → scaling`,
plus `paused`/`killed`); `ProductStatus` describes public availability
(`draft → teaser → alpha → beta → live`). Collapsing them would force one vocabulary to
serve two unrelated audiences.

### 6. Links are a table, not columns

`bet_links` has a `kind` rather than `bets` having `driveUrl`, `tiktokUrl`, `repoUrl`
columns. "Especially TikTok" today means Instagram and YouTube tomorrow, and a bet can
have two Drive folders. A link table absorbs both without a migration.

The same reasoning drives `bet_metrics` being a long table of `(metricKey, value,
recordedOn)` points rather than columns per metric: it is the shape that lets a metric be
added by typing its name, and the shape an automated collector could later write into
unchanged.

## Consequences

- The repository now has a `src/server/` layer, peer to `src/lib/`, and it is the only
  place that may import the database. Files there carry `import 'server-only'`.
- `next build` no longer requires a reachable database, but it does require the code to
  tolerate its absence: `src/server/db/client.ts` constructs the Drizzle instance lazily
  behind a proxy, because Next imports every route module during page-data collection.
- Two new environment variables are mandatory in production: `DATABASE_URL` and
  `INTERNAL_SESSION_SECRET`. The panel fails loudly, not silently, if either is missing.
- Bets are archived, never deleted. The updates, metrics and audit trail attached to a
  killed bet are the most valuable thing it leaves behind.
- `/internal` is excluded from `robots.ts` and carries `robots: { index: false }`. It is
  absent from `sitemap.ts` by construction, since that file is registry-driven.
- The contact form's fake submission is now the only remaining "no backend exists yet"
  workaround in the codebase, and it no longer has an excuse.

## Future considerations

Deliberately out of scope, roughly in value-per-effort order: CSV import/export (the
export matters most — people leave a spreadsheet more readily when they know they can get
the data back out); a weekly digest over Vercel Cron; automated metric collection writing
into the existing `bet_metrics` shape; a reviewed publish flow into the product registry;
file attachments via Vercel Blob; saved views; launch-checklist templates; and OAuth or
passkeys once the team outgrows a handful of accounts.

Note also that Vercel's Hobby plan is licensed for non-commercial use. That is a company
matter rather than a technical one, but it is a real constraint on this deployment target
and is recorded here so it is not rediscovered as a surprise.
