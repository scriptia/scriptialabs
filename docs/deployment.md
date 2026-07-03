# Deployment

There is no CI/CD pipeline or hosting target configured yet — this document covers building and running the production artifact locally; wiring it into an actual deployment platform is future work (see [roadmap.md](roadmap.md)).

## Building the production image

```
docker compose --profile prod build app-prod
docker compose --profile prod up app-prod
```

This runs the Dockerfile's `build` → `runner` stages: `next build` with `output: 'standalone'`, then a minimal runtime image containing only `.next/standalone`, `.next/static`, and `public/` — no `npm`, no dev dependencies, no source files, running as a non-root `nextjs` user. See [docs/docker.md](docker.md) for the full stage breakdown.

## Without Docker

If you need a bare artifact (e.g. for a platform that builds the image itself from the Dockerfile, or expects a standalone Node process):

```
npm ci
npm run build
node .next/standalone/server.js
```

The standalone server reads `PORT` and `HOSTNAME` environment variables (defaults: `3000` and `0.0.0.0` inside the Docker image).

## Environment variables

See `.env.example`. `NEXT_PUBLIC_SITE_URL` is consumed by `src/lib/seo/` for canonical URLs and sitemap generation — set it to the real production origin before deploying anywhere the SEO output needs to be correct, not `localhost`.

## Before this can go to production for real

This repo is engineering-ready, not deploy-ready — there is no homepage yet. Before pointing a real domain at this:

1. Confirm `NEXT_PUBLIC_SITE_URL` is set correctly for the target environment.
2. Decide on a hosting target (Vercel, a container platform, etc.) and wire the actual deploy step — nothing here assumes one.
3. Build the homepage and at minimum the legal pages (privacy/terms/cookies) — `src/content/legal` already models the registry these will read from.
