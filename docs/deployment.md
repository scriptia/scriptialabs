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
   `npm run db:studio` opens a browser UI to confirm the seven tables exist.
4. **Create the first account.** There is no signup route — accounts are created deliberately:
   ```
   npm run seed:user -- <username>
   ```
   It prompts for a display name, password and role. Re-running it for an existing username resets that account's password, which is also how a forgotten password is recovered.
5. Sign in at `/internal/login`.

`db:push`, `db:studio` and `seed:user` read `.env.local` automatically (via `src/server/db/load-env.ts`), since they run outside Next.js and don't get its automatic env loading. An already-exported `DATABASE_URL` always wins over the file, so a one-off run against production is `DATABASE_URL=… npm run seed:user -- <username>`.

## Schema changes

`npm run db:push` applies `src/server/db/schema.ts` to the database directly — acceptable while the panel is young and the data is replaceable. Once there is history worth protecting, switch to generated migrations:

```
npm run db:generate   # writes SQL to ./drizzle
```

and apply them as a deliberate, reviewed step rather than pushing.

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
