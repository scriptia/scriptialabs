# ADR-013 — The public site reads product content from the database

**Status:** accepted
**Supersedes:** ADR-010 §1 ("the public site keeps zero database dependency"), ADR-012's app-deploy design
**Amends:** ADR-003 (product registry), ADR-009 (per-product legal)

## Context

Three systems existed and none of them met in the middle.

`discovery-bets-pipeline` found bets and pushed them to the panel. `product-agent`
turned a Bet Case into a name, identity, features, legal documents and a store
package — but read its input from a sibling checkout on the same disk, could only
be started by a human at a terminal, and could publish nothing: `deploy_legal.py
--publish` refused, because ADR-011 deliberately gave scriptialabs exactly one
write route.

Meanwhile the public site was statically generated from `src/content/products`
and `src/messages`, and ADR-010 forbade it from reading the database. So the
panel — the thing we call the source of truth — was a read-only board. Changing a
status there changed nothing anyone outside could see.

A design for closing this already existed: `src/server/apps/mutate-content-files.ts`
would splice a new product into six TypeScript source files with ts-morph, commit
them via the GitHub API, and let Vercel rebuild. It was written, smoke-tested,
and never wired to a route.

## Decision

**The database is the source of truth for public product content.** Product pages,
product-legal pages, the navbar, the footer, the homepage cards, `/products` and
the sitemap all read from Postgres through one module,
`src/server/queries/public-products.ts`.

The ts-morph path is deleted, along with `src/content/products`' registry,
`src/content/legal/product-legal.ts`, `message-keys.ts`, and the `products` /
`productLegal` message blocks (three files, 125 KB → 24 KB each).

### Why not the commit-and-rebuild design

It would have worked, and 80% of it was built. Three things decided against it:

1. **It does not make the panel a control panel.** Flipping a status would mean
   an AST mutation, a commit to `main` and a two-to-three minute rebuild. The
   whole point was that the panel controls what the public sees.
2. **A malformed splice breaks the entire site**, not one page. An AST mutation
   driven by machine-generated input is a build failure waiting to happen, and
   the blast radius is every route.
3. **It has no unpublish.** Recovering from a bad automated publish would mean
   another commit and another rebuild.

### What replaced ADR-010's protection

ADR-010 kept the database out of the public tree so a database outage could not
take the marketing site down. That concern was right and still applies, so it is
handled rather than dismissed:

- Public routes are ISR (`revalidate = 3600`) with `dynamicParams = true`. Pages
  are served from Vercel's edge cache with no database involvement. An outage
  stops *new* pages and *revalidations*, not serving.
- Every query is `unstable_cache`-wrapped with tags, so the public tree stays
  statically rendered — the build output must still show `●`/`○` for
  `/[locale]/*`, and `docs/deployment.md` checks it on every deploy.

The trade is explicit: **a database outage degrades the public site to stale,
where before it could not degrade at all.** That is the cost of the panel being
able to change anything.

## The one predicate

A product is public iff `publishedAt IS NOT NULL AND status != 'archived'`.

That expression appears **once**, in `queries/public-products.ts`. Nothing public
queries `products` directly. This is deliberate and load-bearing: two copies of a
publication rule in two files is exactly how a product ends up linked from the
products index and 404ing when you click it. Because the resolver, every listing,
the nav, the footer, `generateStaticParams` and the sitemap all derive from the
same call, "no broken links" is a property of the design rather than something a
test hopes to catch.

`scripts/check-public-links.mjs` checks it anyway, after every deploy.

## Consequences

- **Publishing is an API call.** `POST /api/ingest/products`, behind
  `PRODUCT_INGEST_TOKEN`, tied to a `pipeline_runs` row. A page is live seconds
  later via tag revalidation.
- **Unpublishing is a button.** `/internal/products/<slug>`.
- **Localized copy is jsonb `{en,es,ca}`**, not a row per locale — the neon-http
  driver has no interactive transactions, and three rows per string is three
  round trips that can half-fail and leave a live page with an English hero and
  no Catalan one.
- **`indexable` is separate from `publishedAt`.** A `ready` product is live and
  linked but not submitted to search until a human says so. One column drives
  both the sitemap and the page's robots meta, so they cannot contradict each
  other — which they previously did for three products.
- **The seed script is gone.** `scripts/seed-products.ts` read the registry it
  migrated from; with that registry deleted it cannot run again. Re-seeding means
  restoring the database, not re-running a script. This is the real
  point-of-no-return of this ADR.
- **`src/content/products` survives as vocabulary only** — `productStatuses` and
  its type guard, shared by the schema, the publish payload, the badges and the
  panel. Same role `bet-status.ts` plays.
- **`src/messages` now owns only chrome that is identical across products**
  (`common.legalDocLabels`, `legal.common.*`, `common.productStatus`). Nothing
  product-specific remains there.

## Verified before the switch

`scripts/verify-product-parity.mjs` rendered both sources and compared `<main>`,
the navbar and footer, `<title>`, description, robots, canonical, every hreflang,
the JSON-LD block and every link — with no whitelist. It was itself verified to
be build-stable and to fail on a single corrupted string before its result was
trusted.

That harness is retained. It no longer has two sources to compare, but it
documents what "identical" was taken to mean.
