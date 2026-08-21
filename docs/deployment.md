# Deployment

The site is deployed on **Vercel**, which builds from the repository directly — it does not use the Dockerfile. The Docker setup remains the supported local development and self-hosting path (see [docs/docker.md](docker.md)); the two are independent.

> Vercel's Hobby (free) plan is licensed for non-commercial use. That is a company matter rather than a technical one, but it is a real constraint on the current target and is recorded here rather than left to be rediscovered.

## Environment variables

See `.env.example`.

| Variable | Needed by | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Public site | Consumed by `src/lib/seo/` for canonical URLs and sitemap generation. Set it to the real production origin, not `localhost`. |
| `DATABASE_URL` | `/internal` only | Injected automatically by the Neon integration on Vercel. |
| `INTERNAL_SESSION_SECRET` | `/internal` only | Signs the internal session cookie. At least 32 random characters. |
| `INGEST_TOKEN` | `/api/ingest/bets` only | Shared bearer secret for the discovery pipeline's push (see [ADR-011](adr/ADR-011-ingest-api.md)). Unset means the endpoint answers 503 — it never falls open. Generate it the same way as the session secret. |

The public site never reads the database. If `DATABASE_URL` is absent the marketing pages still build and serve correctly — only `/internal` fails, and it fails loudly rather than silently.

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
5. **Seed the public product content.**
   ```
   npm run seed:products -- --dry-run   # prints what it would write, touches nothing
   npm run seed:products
   ```
   This projects the products, features and legal documents that used to live in `src/content/products`, `src/content/legal/product-legal.ts` and the three message files into the database. It is idempotent (upserts on slug / key / docKey) and it throws on a missing message key rather than writing a blank — an empty string would render as a blank heading on a live page instead of stopping the seed.

   Expected today: **4 products, 12 features, 20 legal documents, 183 legal sections** (549 localized bodies). `accento` and `nailio` are `archived` and deliberately not seeded — they have no copy in any locale.
6. Sign in at `/internal/login`.

`db:push`, `db:studio`, `seed:user` and `seed:products` read `.env.local` automatically (via `src/server/db/load-env.ts`), since they run outside Next.js and don't get its automatic env loading. An already-exported `DATABASE_URL` always wins over the file, so a one-off run against production is `DATABASE_URL=… npm run seed:user -- <username>`.

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

The build output is the check that matters most: every public route must remain `●` (SSG) or `○` (static), and only `/internal/*` may appear as `ƒ` (dynamic). If a public route turns dynamic, something has pulled a request-scoped or database-backed dependency into the static tree.

Then, against the preview URL: the public pages render in all three locales, `/internal` redirects to `/internal/login` when signed out, `/en/internal` returns 404 (proving next-intl is not picking the panel up), and `/robots.txt` disallows `/internal/`.

### Where public content comes from

`PUBLIC_CONTENT_SOURCE` selects whether product pages, product-legal pages, the navbar, the footer, the homepage cards, `/products` and the sitemap read from `src/content/products` + the message files (`code`, the default) or from the database (`db`).

Both feed the same view models and the same JSX, so the only way to tell them apart should be a bug. To flip:

```
npm run seed:products                                   # once, against the target database
# deploy with PUBLIC_CONTENT_SOURCE unset — nothing user-visible changes
node scripts/verify-product-parity.mjs <code-url> <db-url>   # must print zero differences
# set PUBLIC_CONTENT_SOURCE=db in Vercel and redeploy
```

**Running the two servers locally.** `next build` reads `.env.local`; the standalone server does **not**. `DATABASE_URL` has to be exported into the shell that starts it, or every page that revalidates will 500 while the prerendered ones look fine:

```
export DB="$(grep ^DATABASE_URL .env.local | cut -d= -f2-)"

PUBLIC_CONTENT_SOURCE=code npm run build
cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/
DATABASE_URL="$DB" PUBLIC_CONTENT_SOURCE=code PORT=3101 node .next/standalone/server.js &

PUBLIC_CONTENT_SOURCE=db npm run build
cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/
DATABASE_URL="$DB" PUBLIC_CONTENT_SOURCE=db PORT=3102 node .next/standalone/server.js &

node scripts/verify-product-parity.mjs http://127.0.0.1:3101 http://127.0.0.1:3102
```

The script preflights both servers and exits 2 with a diagnosis rather than reporting a misconfigured server as content differences.

Rollback is unsetting the variable. The parity script compares `<main>`, the navbar and footer, `<title>`, description, robots, canonical, every hreflang, the JSON-LD block and every link — with no whitelist. It is verified to be build-stable (two independent builds of identical source produce zero differences) and to actually fail (a single corrupted product tagline produces 31 differences). Treat any non-zero result as a seed or adapter defect, never as noise.

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
