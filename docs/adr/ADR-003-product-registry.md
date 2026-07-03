# ADR-003: Product Registry

## Context

Scriptia Labs runs multiple products at different maturity stages simultaneously — some public and indexable, some in a private teaser state ahead of launch. Navigation, the sitemap, and (eventually) product pages all need to reflect the *current* state of each product without per-surface conditionals scattered through the codebase.

## Decision

Model each product as a `ProductRecord` in `src/content/products/index.ts`:

- `status: 'draft' | 'teaser' | 'alpha' | 'beta' | 'live' | 'deprecated' | 'archived'` — where the product actually is.
- `availability: 'public' | 'private' | 'teaser'` — who can see it.
- `seo.indexable: boolean` — independent of both of the above, since a product can be publicly linked but intentionally not indexed yet.

`productRegistry` is explicitly typed as `Record<ProductRecord['id'], ProductRecord>` (not left to `satisfies`-inferred narrowing — see [engineering.md](../engineering.md) for why that distinction matters), so every consumer gets the full declared shape, including optional fields, with no per-call-site type gymnastics.

Navigation (`src/content/navigation`) and the sitemap (`src/app/sitemap.ts`) both derive from this registry by filtering on `status !== 'archived'`, rather than maintaining separate lists that could drift from what the registry says.

## Alternatives considered

- **A single `visible: boolean` flag.** Rejected: collapses "is this live," "who can see it," and "should search engines index it" into one bit, which doesn't hold up — Padelco needs to be linked internally (teaser) without being publicly indexable, which a single boolean can't express.
- **Per-product page components deciding their own visibility.** Rejected: pushes the same status logic into N places instead of one, and makes "which products are currently live" a question you have to answer by reading every page instead of one file.

## Consequences

- Adding a product, or changing one's launch stage, is a one-line change to `status`/`availability`/`seo.indexable` in the registry — navigation, sitemap, and (once built) product pages all follow automatically.
- The literal-union approach to `id`/`slug` (`'scriptia' | 'padelco' | 'voice-agents'`) means the type system enforces valid product references everywhere, at the cost of needing a type edit (not just a data edit) to add a product. Acceptable at 3 products; noted as a scaling limit in [ADR-001](ADR-001-project-architecture.md).

## Future considerations

- If a product needs staged rollout (visible to some locales but not others, or a percentage rollout), the registry will need a rollout field rather than overloading `availability` further.
- `translations`, `social`, and `futureFlags` fields exist on `ProductRecord` but are empty `{}` for every product today — they're there because the shape was designed for known future needs (per-product social links, feature flags), not populated speculatively. Populate them when a product actually needs one, don't backfill them "just in case."

## Addendum: Product Pages (2026-07)

The Product Pages phase built `/scriptia`, `/padelco`, and `/voice-agents` and confirmed this registry's design held up under real content — a few extensions were needed, none of them a reversal:

- **`ProductStatus` gained `'deprecated'`**, between `live` and `archived`, so the full lifecycle (Concept → Private Alpha → Public Beta → Launching Soon → Live → Deprecated → Archived) has a status for every stage a product can honestly be in, including winding one down before removing it entirely.
- **`product.features` is now populated** (3 entries per product) — the field existed since the registry's original design but sat empty until product pages gave it a real consumer.
- **The status label pattern was centralized**, not just typed: `ProductStatusBadge` (`src/components/data/product-status-badge.tsx`) is now the only place that maps a `ProductStatus` to a visual tone, and `common.productStatus.*` in the message files is the only place that maps it to display text. Before this phase, the navbar's product dropdown rendered the raw, untranslated `ProductStatus` string directly (e.g. literally the word "teaser") — a real bug this phase fixed by routing every status display through the same component and the same translation keys.
- **One dynamic route, not three static ones.** `/scriptia`, `/padelco`, `/voice-agents` are served by a single `src/app/[locale]/(site)/[productSlug]/page.tsx`, with `generateStaticParams` sourced directly from `products.filter(p => p.status !== 'archived')`. A fourth product needs a registry entry and translated copy — no new page file, confirming the registry's original goal ("adding a product... is a one-line change") extends cleanly to full product pages, not just navigation and the sitemap.
