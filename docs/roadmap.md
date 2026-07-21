# Roadmap

## Completed

- **Engineering audit** — repository read, architecture review, validation of lint/typecheck/build/Docker, scored report.
- **Production readiness** — Docker hardened with a real production stage, lockfile committed, Storybook migrated to a working builder, half-finished component stubs resolved, dependency audit, documentation and ADRs written, full quality gate green.
- **Homepage V1** — first real page shipped (`/`), full narrative homepage in EN/ES/CA composed entirely from existing design-system components.
- **Product Pages** — `/scriptia`, `/padelco`, `/voice-agents` shipped via one dynamic route, driven entirely by the product registry and messages — adding product #4 requires zero new route files. See [ADR-003 addendum](adr/ADR-003-product-registry.md#addendum-product-pages-2026-07).
- **Legal & Compliance** — `/privacy`, `/terms`, `/cookies`, `/contact`, `/security`, `/ai-policy` shipped, company-wide, in EN/ES/CA. Merged into the same dynamic route as Product Pages — Next.js doesn't allow two separate dynamic routes at the same URL depth. See [ADR-008](adr/ADR-008-legal-routing.md).
- **Padelco Legal & Compliance V1** — the company-wide model above was superseded for Padelco specifically: it now has its own 7-document legal set (`/padelco/legal/{privacy,terms,cookies,ai-policy,contact,data-deletion,acceptable-use}`) written to satisfy App Store/Play Store review, in EN/ES/CA. Scriptia and Voice Agents remain on the company-wide fallback until they need their own. See [ADR-009](adr/ADR-009-per-product-legal.md).

- **Internal panel V1** — `/internal`, the first backend in the codebase: Neon Postgres + Drizzle, per-user accounts, and bet tracking with typed links (Drive, repo, TikTok and the rest), an append-only update log, manual metric snapshots with trend lines, a kanban board, per-bet tasks, and an audit trail. Replaces the tracking spreadsheet. The public site keeps zero database dependency and stays fully static. See [ADR-010](adr/ADR-010-internal-panel.md).

## Next approved phase

**Not yet assigned.** Release tasks remain unscheduled.

## Known gaps, deliberately deferred

These are real gaps, not hidden ones — listed here so they aren't rediscovered as surprises mid-homepage-build:

- **No test runner wired up.** `tests/{unit,integration,e2e,a11y,visual,fixtures}` exist as reserved, empty directories; there's no Vitest/Playwright/Jest config and no `test` script. Worth doing before or alongside the homepage build, not after — retrofitting tests onto pages that already exist is more expensive than writing them alongside.
- **No CI pipeline.** Quality gates (lint/typecheck/build/storybook) are currently run manually or via Docker locally; nothing enforces them on push/PR yet.
- **Unmatched slugs under a locale are soft 404s.** `/en/anything-invalid` renders the not-found page but returns HTTP 200 instead of 404. `notFound()` is called correctly in `src/app/[locale]/(site)/[slug]/page.tsx`, and a related bug — `notFound()` being called from `generateMetadata`, where it cannot set a status — was fixed during the internal-panel work, but the status is still 200 in both dev and a production build. Paths that match no route at all (e.g. `/en/a/b/c`) do return 404 correctly, so this is specific to `notFound()` inside the `[slug]` route. Worth chasing: search engines treat a soft 404 as a real page.
- **No CI enforcement of the quality gate on the internal panel either.** Deployment itself is resolved — the site is on Vercel (see [deployment.md](deployment.md)) — but nothing runs lint/typecheck/build on push.
- **The internal panel has no CSV import or export.** The spreadsheet's contents have to be re-entered by hand today. Export matters more than import: people leave a spreadsheet more readily when they know they can get the data back out.
- **Metric snapshots are entered manually.** `bet_metrics` is shaped so an automated collector (TikTok/YouTube APIs, web analytics) could write into it unchanged, but none exists.
- **`npm run db:push` applies schema changes directly**, with no migration history. Fine while the panel's data is replaceable; switch to `db:generate` before it isn't.
- **Major dependency versions are behind on purpose.** `next` (15→16), `tailwindcss` (3→4), `eslint` (9→10), `typescript` (5→6) are all at least one major behind latest. Each is a deliberate, scheduled upgrade — Tailwind 4 in particular changes the config format and would touch the entire token/theme layer, so it should be its own reviewed change, not incidental to a feature PR.
- **No comparison table or metrics section exists on product pages**, deliberately — none of the three products has public metrics or a competitive comparison to publish yet. Neither component was built; add them when there's real data to show, not before.
- **All legal content (company-wide and Padelco's) needs lawyer review before real launch.** It's original, well-structured, and modeled on how mature software companies and App Store/Play Store-published apps organize this content — but it is not a substitute for review by qualified legal counsel, particularly the governing-law placeholders and any jurisdiction-specific obligations (GDPR specifics, CCPA, COPPA, etc.) that depend on where Scriptia Labs is actually registered and who its users are.
- **No consent management platform (CMP) for cookies.** Both the company-wide and Padelco Cookie Policies document this as a stated future step, not a current gap being hidden — necessary/functional cookies don't currently need one, but adding analytics or marketing cookies later will.
- **Scriptia and Voice Agents don't have their own legal documents yet.** They rely on the company-wide fallback (see [ADR-009](adr/ADR-009-per-product-legal.md)). Revisit if either becomes its own app-store-distributed product, which would face the same review requirements Padelco does today.
- **Padelco's Data Deletion page describes an email-based process, not in-app self-service deletion**, because no in-app deletion flow exists yet — stated honestly in the document itself as a near-term addition, not hidden.

## What should not change without a strong reason

Carried over from the engineering audit and reconfirmed during this pass — these are the parts of the foundation that are actually solid:

- The semantic token architecture (`src/design/tokens` → `theme` → Tailwind).
- The product registry's status/availability modeling.
- The SEO composition layer (`src/lib/seo`, `sitemap.ts`).
- Strict TypeScript with zero `any`.
- Docker-first development as the primary supported workflow.
