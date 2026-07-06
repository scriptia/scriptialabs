# Scriptia Labs

The corporate site and platform foundation for Scriptia Labs — a Software & AI Lab building Scriptia, Padelco, and Voice Agents. This repository is the shared shell those products will be presented through: it is treated as a long-lived application platform, not a marketing site with some code behind it.

The homepage (`/`), all three product pages (`/scriptia`, `/padelco`, `/voice-agents`), and the company-wide legal pages (`/privacy`, `/terms`, `/cookies`, `/contact`, `/security`, `/ai-policy`) are live, in English, Spanish, and Catalan. **Legal documentation is per-product, not company-wide** — Padelco (a native iOS/Android app subject to App Store/Play Store review) has its own complete set at `/padelco/legal/*`; Scriptia and Voice Agents still use the company-wide pages as a fallback until they need their own. See [ADR-009](docs/adr/ADR-009-per-product-legal.md).

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS 3, with a semantic token layer over it
- next-intl (English / Spanish / Catalan)
- Framer Motion, Lucide icons
- Storybook 10 on the Vite builder
- Docker-first development, with a separate production build stage

## Quick start

```
git clone <repo>
docker compose up
```

That's it — no local Node install required. This starts the Next.js dev server on **http://localhost:3000** and Storybook on **http://localhost:6006**, both with hot reload via the bind-mounted source tree.

To run the production image instead:

```
docker compose --profile prod up app-prod
```

See [`docs/docker.md`](docs/docker.md) for the full breakdown of dev vs. production stages, healthchecks, and image sizes.

## Documentation

| Doc | Covers |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Routing, layouts, request lifecycle, folder structure |
| [`docs/design-system.md`](docs/design-system.md) | Tokens, Tailwind mapping, component library, what's built vs. not |
| [`docs/engineering.md`](docs/engineering.md) | Conventions, type safety, dependency policy, quality gates |
| [`docs/docker.md`](docs/docker.md) | Dev/prod Docker stages, compose services, healthchecks |
| [`docs/storybook.md`](docs/storybook.md) | Storybook setup, the Vite builder migration, writing stories |
| [`docs/deployment.md`](docs/deployment.md) | Building and running the production image |
| [`docs/contributing.md`](docs/contributing.md) | Local workflow, PR expectations, where things live |
| [`docs/roadmap.md`](docs/roadmap.md) | What's next, in what order |
| [`docs/adr/`](docs/adr/) | Why key decisions were made, alternatives considered |

## Structure

```
src/app          App Router shell, metadata, route infrastructure
src/components   Design system and library components (see design-system.md)
src/content      Products, navigation, SEO, routes, legal content as typed data
src/design       Token definitions and Tailwind theme mapping
src/lib          Routing, SEO, i18n, motion, and validation utilities
src/messages     Localized message payloads (en / es / ca)
src/styles       Global CSS and token bootstrap
docs             Architecture, system, and decision documentation
docs/adr         Architecture Decision Records
tests            Reserved for unit/integration/e2e/a11y/visual suites (not yet wired up — see roadmap.md)
.storybook       Storybook configuration
```

## Conventions

- Keep content centralized in `src/content` — no copy-pasted strings or hrefs in JSX.
- Keep tokens centralized in `src/design` and `src/styles`; components consume semantic Tailwind classes, never raw hex.
- Prefer server components by default; add `'use client'` only when interaction requires it.
- Treat translations as structured data (`src/messages`), not inline strings.
- Every exported component ships with a story. A component with no consumer and no finished behavior gets removed, not left half-built — see [ADR-002](docs/adr/ADR-002-design-system.md).

## Quality gates

```
npm run lint        # 0 errors
npm run typecheck    # 0 errors
npm run build         # production build
npm run build-storybook
```

All four run cleanly on the current `main`. Run them inside Docker (`docker compose run --rm app <script>`) if you don't have Node installed locally.

## Roadmap

The engineering foundation, Homepage V1, Product Pages, company-wide Legal & Compliance, and Padelco's own Legal & Compliance V1 are complete. See [`docs/roadmap.md`](docs/roadmap.md) for what's next.
