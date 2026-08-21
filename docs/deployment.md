# Deployment

The site is deployed on **Vercel**, which builds from the repository directly — it does not use the Dockerfile. The Docker setup remains the supported local development and self-hosting path (see [docs/docker.md](docker.md)); the two are independent.

> Vercel's Hobby (free) plan is licensed for non-commercial use. That is a company matter rather than a technical one, but it is a real constraint on the current target and is recorded here rather than left to be rediscovered.

## Environment variables

See `.env.example`.

| Variable | Needed by | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Public site | Consumed by `src/lib/seo/` for canonical URLs and sitemap generation. Set it to the real production origin, not `localhost`. |
| `DATABASE_URL` | Public site **and** `/internal` | Injected automatically by the Neon integration on Vercel. Since [ADR-013](adr/ADR-013-database-backed-public-content.md) the public product and legal pages read it too. |
| `INTERNAL_SESSION_SECRET` | `/internal` only | Signs the internal session cookie. At least 32 random characters. |
| `INGEST_TOKEN` | `/api/ingest/bets` | Bearer secret for the discovery pipeline's push (see [ADR-011](adr/ADR-011-ingest-api.md)). |
| `PIPELINE_RUNNER_TOKEN` | `/api/runs/*` | Lets product-agent's runner claim queued runs and report on them. |
| `PRODUCT_INGEST_TOKEN` | `/api/ingest/products` | Lets a finished run publish a product to the public site. Separate from the runner token on purpose: polling a queue and overwriting a live page have different blast radii. |
| `BLOB_READ_WRITE_TOKEN` | `/api/runs/*/assets` | Injected by the Vercel Blob integration. Stores product icons and logos. |
| `CRON_SECRET` | `/api/cron/*` | Shared by the overdue-task and run-reaper crons. |

Any token left unset makes its endpoint answer **503** ("not configured"), never 401 — a missing secret looks like a deployment problem rather than a caller error.

The public site now depends on `DATABASE_URL`. Because those pages are ISR-cached, an outage degrades them to stale rather than down — but a first build with no database produces no product pages at all.

## First-time setup for the internal panel

1. **Provision the database.** Vercel dashboard → Storage → Neon. The integration injects `DATABASE_URL` into every environment.
2. **Set the session secret** in Project Settings → Environment Variables. Generate one with:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. **Create the tables.** From a local checkout, with `DATABASE_URL` pointing at the Neon database:
   ```
   npm run db:push
   ```
   `npm run db:studio` opens a browser UI to confirm the tables exist.
4. **Create the first account.** There is no signup route — accounts are created deliberately:
   ```
   npm run seed:user -- <username>
   ```
   It prompts for a display name, password and role. Re-running it for an existing username resets that account's password, which is also how a forgotten password is recovered.
5. Sign in at `/internal/login`.

Product content is **not** seeded from code any more. The one-time migration that moved the six hand-written products into the database ran before [ADR-013](adr/ADR-013-database-backed-public-content.md) deleted the registry it read from; there is no script to re-run. A fresh database starts with no products, and they arrive by running the product agent on a bet. Restoring existing ones means restoring the database.

`db:push`, `db:studio` and `seed:user` read `.env.local` automatically (via `src/server/db/load-env.ts`), since they run outside Next.js and don't get its automatic env loading. An already-exported `DATABASE_URL` always wins over the file, so a one-off run against production is `DATABASE_URL=… npm run seed:user -- <username>`.

## Schema changes

`npm run db:push` applies `src/server/db/schema.ts` to the database directly — acceptable while the panel is young and the data is replaceable. Once there is history worth protecting, switch to generated migrations:

```
npm run db:generate   # writes SQL to ./drizzle
```

and apply them as a deliberate, reviewed step rather than pushing.

**That point has arguably arrived.** The `products`, `product_legal_documents` and `product_legal_sections` tables now hold the live public site's copy, which is no longer replaceable — losing it means the marketing pages and every App Store legal URL go with it. Switching is not a one-liner, though: this database was built by `db:push`, so `db:generate` with no migration history emits a baseline that `CREATE TABLE`s everything, including the tables that already exist. Doing it properly means generating that baseline, marking it applied against the existing database, and only then generating incremental migrations. Worth doing deliberately, not as a side effect of the next schema change.

To sanity-check that a schema edit produces valid SQL without committing a migration, point `drizzle-kit generate` at a throwaway `out` directory and read the result.

## Building locally

```
npm ci
npm run build
node .next/standalone/server.js
```

The standalone server reads `PORT` and `HOSTNAME` (defaults `3000` and `0.0.0.0` inside the Docker image). Via Docker, which runs the Dockerfile's `build` → `runner` stages to produce a minimal non-root runtime image:

```
docker compose --profile prod build app-prod
docker compose --profile prod up app-prod
```

## Verifying a deploy

The build output is the check that matters most: every public route must remain `●` (SSG) or `○` (static), and only `/internal/*` and `/api/*` may appear as `ƒ` (dynamic). If a public route turns dynamic, something has pulled a request-scoped dependency into the static tree — note that reading the database is fine as long as it goes through the `unstable_cache`-wrapped helpers in `src/server/queries/public-products.ts`; reading it directly is what breaks this.

Then, against the preview URL: the public pages render in all three locales, `/internal` redirects to `/internal/login` when signed out, `/en/internal` returns 404 (proving next-intl is not picking the panel up), and `/robots.txt` disallows `/internal/`.

### Where public content comes from

The database (ADR-013). Product pages, product-legal pages, the navbar, the footer, the homepage cards, `/products` and the sitemap all read from Postgres through `src/server/queries/public-products.ts`, which holds the one publication predicate: a product is public iff it has a `publishedAt` and is not `archived`.

Pages are ISR (`revalidate = 3600`, `dynamicParams = true`) with tag-based invalidation, so a product published from the panel is live in seconds without a rebuild — and a database outage degrades the public site to stale rather than down.

`scripts/verify-product-parity.mjs` was the gate used to prove the database rendered identically to the old code registry before the switch. The registry is gone, so it has nothing left to compare, but it is kept as the record of what "identical" was taken to mean.

### 404s must be real 404s

Check the status code, not the page:

```bash
curl -sI https://<preview>/en/does-not-exist        | head -1   # HTTP/2 404
curl -sI https://<preview>/en/padelco/legal/nope    | head -1   # HTTP/2 404
curl -sI https://<preview>/en/padelco/legal/privacy | head -1   # HTTP/2 200
```

This is a real regression this project has already shipped once. A route-level `loading.tsx` wraps its subtree in a Suspense boundary, which makes Next flush the HTML shell — committing `200` — before the page body runs and calls `notFound()`. Every unmatched route then answered `200` with a 145 KB body and the generic `Scriptia Labs` title. `src/app/loading.tsx` and `src/app/[locale]/loading.tsx` were deleted for exactly this reason; see the comment on `RouteLoadingState` in `src/components/layout/route-states.tsx` before adding either back.

It matters beyond SEO: product-agent probes the legal URLs it publishes here, and a legal URL that soft-404s is an App Store rejection. Its `deploy_legal.py` checks the `<title>` rather than the status because the status could not be trusted.

### No broken links

```
npm run check:links -- https://<preview-or-production>
```

Fetches every URL in the sitemap, then every legal link rendered on every product page, and asserts each returns 200 with a real `<title>` rather than the site shell. It ends by requesting a URL that must not exist — if that returns anything but 404, soft 404s are back and every other assertion in the run is worthless.

Run it after each deploy and nightly. It has already caught one real defect: `/about`, `/careers`, `/blog` and `/press` were in the sitemap with no pages behind them.

`.env.example` documents `PUBLIC_CONTENT_SOURCE`; leaving it unset is the safe default.
