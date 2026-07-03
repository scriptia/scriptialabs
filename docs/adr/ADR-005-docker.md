# ADR-005: Docker

## Context

The team decision is Docker-first development: `git clone` + `docker compose up` should work with nothing else installed, so no contributor needs a matching local Node version or global tooling. The original Dockerfile only had a `dev` stage — it worked for local development but had no path to a deployable production image, and (found during the engineering audit) `docker compose build` failed outright from a clean checkout on a Storybook peer-dependency conflict that an absent lockfile let through.

## Decision

Four-stage Dockerfile:

- `base` — `node:22-alpine`, shared workdir and telemetry setting.
- `deps` — `npm ci` against a **committed** `package-lock.json`. `npm ci` fails fast on any package.json/lockfile drift, instead of silently re-resolving (which is what let the broken Storybook combination in originally).
- `dev` — deps + full source, runs `npm run dev`. This is what `docker compose up` targets; source is bind-mounted, so this stage's own `COPY . .` only matters for one-off `docker compose run` invocations, not the running dev container.
- `build` → `runner` — `next build` with `output: 'standalone'`, then a minimal runtime image with only the standalone server, static assets, and `public/`, running as a non-root user, with a `HEALTHCHECK`.

`docker-compose.yml` keeps `app` (Next.js dev) and `storybook` (Storybook dev) as the default services, and adds `app-prod` behind a `prod` compose profile — so `docker compose up` stays dev-first by default, and the production path is opt-in (`docker compose --profile prod up app-prod`).

## Alternatives considered

- **Single-stage image for everything.** Rejected: would ship dev dependencies (Storybook, Vite, TypeScript) in the production runtime, inflating the image (dev image is ~1GB vs. ~310MB for the production image) and expanding the attack surface for no benefit.
- **`npm install` instead of `npm ci` everywhere.** Rejected for the `deps` stage: `npm install` will happily resolve a new dependency graph even when the lockfile is stale or absent, which is exactly the failure mode that broke the build before this pass. `npm ci` is stricter on purpose.
- **Making `app-prod` a default-up service.** Rejected: local development should never accidentally start a production-mode container; the profile gate makes production a deliberate choice.

## Consequences

- Any dependency change must regenerate the lockfile in the same commit, or `npm ci` in the `deps` stage will fail on the next build — this is intentional friction, not a bug.
- The production image needs a `public/` directory to exist (even empty, with a `.gitkeep`) because `COPY --from=build /app/public ./public` fails on a missing source path — this repo has one for exactly that reason, ready for real assets (favicons, etc.) once they exist.
- Hot reload was explicitly re-verified after these changes (editing a file on the host reflects in the running dev container within seconds) — a Docker hardening pass that broke dev ergonomics to gain production readiness would have been a net loss.

## Future considerations

- Once a real deployment target is chosen (see [deployment.md](../deployment.md)), the `runner` stage's `HOSTNAME`/`PORT` environment defaults may need to change to match that platform's conventions.
- If image size becomes a concern beyond ~310MB, investigate Next.js's `output: 'standalone'` bundling more granularly (e.g. excluding unused locale message payloads at build time) — not attempted in this pass since 310MB was judged acceptable.
