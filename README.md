# Scriptia Labs

Scriptia Labs is the internal UI and platform foundation for the corporate website of a long-lived AI software company. The repository is organized as an application platform first and a website second.

## Philosophy

- Architecture first.
- Content is data, not scattered JSX literals.
- Locale is part of the routing contract.
- Design tokens are the interface between brand and implementation.
- Reusable UI must be documented before product pages exist.

## Stack

- Next.js 15 with App Router
- React 19
- TypeScript
- Tailwind CSS
- shadcn/ui foundation
- Framer Motion
- next-intl
- Lucide Icons
- Storybook
- Docker development environment
- ESLint
- Prettier

## Design System

The design system lives in `src/components`, `src/design`, and `src/styles`.

- `src/design/tokens` defines the token source of truth.
- `src/styles/global.css` maps tokens into CSS variables and base styles.
- `src/components/primitives` contains the base controls.
- `src/components/typography` contains the text system.
- `src/components/surfaces` contains layout primitives.
- `src/components/data`, `src/components/display`, `src/components/feedback`, `src/components/navigation`, `src/components/media`, and `src/components/motion` contain reusable library components.

## Storybook

Storybook is the visual documentation layer for the design system.

- Run it with `npm run storybook`.
- Build it with `npm run build-storybook`.
- Story files live next to the components they document.
- Stories use autodocs so props and variants can be reviewed in the browser.

## Docker

Docker is the recommended development workflow.

- Run `docker compose up` from the repository root.
- The compose file starts both the Next.js app and Storybook with hot reload.
- The Dockerfile is intentionally development-oriented so no manual setup is required beyond cloning and starting the compose stack.

## Structure

- `src/app` — App Router shell, metadata, and route infrastructure
- `src/components` — reusable design system and library components
- `src/content` — products, navigation, SEO, routes, and legal content models
- `src/design` — token definitions and theme mapping
- `src/lib` — shared utilities, routing helpers, SEO builders, and i18n helpers
- `src/messages` — localized message payloads
- `src/styles` — global CSS and token bootstrap
- `tests` — unit, integration, and E2E tests when implementation begins
- `docs` — architecture and system documentation
- `.storybook` — Storybook configuration

## Setup

Recommended:

1. Install Docker.
2. Run `docker compose up`.
3. Open the app on port 3000 and Storybook on port 6006.

Alternative local flow:

1. Install dependencies with your preferred package manager.
2. Run the development server.
3. Run Storybook separately when working on the design system.

## Conventions

- Keep content centralized in `src/content`.
- Keep tokens centralized in `src/design` and `src/styles`.
- Keep route logic thin and declarative.
- Prefer server components by default.
- Add client components only when interaction requires them.
- Treat translations as structured data, not copy pasted strings.
- Keep public components documented and story-driven.
- Prefer composition over prop-heavy abstraction.

## Architecture changes

If implementation reveals a weakness in the architecture, stop and document the issue before proceeding. This repository should never trade structure for speed.

## Roadmap

The current phase establishes the reusable design system only. The next phases will add localized public routes, marketing surfaces, product pages, and content delivery workflows without changing the core architecture.