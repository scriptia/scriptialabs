# ADR-008: Legal Page Routing

## Context

The Legal & Compliance phase needed six pages — `/privacy`, `/terms`, `/cookies`, `/contact`, `/security`, `/ai-policy` — at flat top-level URLs, following the same "no `/legal/` prefix" convention product pages already used (`/scriptia`, not `/products/scriptia`). Following the exact pattern from [ADR-003's Product Pages addendum](ADR-003-product-registry.md#addendum-product-pages-2026-07) — one dynamic route driven by a content registry, not one file per page — a second dynamic route was built: `src/app/[locale]/(legal)/[legalSlug]/page.tsx`, alongside the existing `src/app/[locale]/(site)/[productSlug]/page.tsx`.

This failed immediately, in two stages. First, Next.js's dev server refused to start: *"You cannot use different slug names for the same dynamic path."* Renaming both segments to a shared `[slug]` fixed that error, but revealed the real constraint underneath it: *"You cannot have two parallel pages that resolve to the same path."* Route groups — the `(site)` and `(legal)` parentheses — are invisible in the URL. `/scriptia` and `/privacy` are both, structurally, `/[locale]/[slug]`, regardless of which route group each lives in. Next.js will not let two different page files both claim that one pattern, no matter how the param is named.

## Decision

**One route, not two**: `src/app/[locale]/(site)/[slug]/page.tsx` resolves against *both* the product registry and the legal document registry, in that order, rendering whichever view matches and calling `notFound()` if neither does. The `(legal)` route group and its now-empty layout were deleted entirely — it added a conceptual grouping with no remaining functional or routing purpose once the pages themselves had to merge.

`generateStaticParams` returns the union of every published product's slug and every legal document's slug. `generateMetadata` and the page component each branch early: check `getProductBySlug`, then check `getLegalDocumentEntryBySlug`, then `notFound()`.

This isn't a workaround bolted onto a broken design — it reflects what was already true. Scriptia Labs has exactly one flat namespace of top-level slugs, populated from two different content sources. Two routes were never actually independent; they were two files racing to claim the same URL space, and Next.js's error was correct to reject that.

## Alternatives considered

- **Prefix legal pages under `/legal/privacy`, `/legal/terms`, etc.** Rejected: contradicts the explicit requirement for flat URLs (`/privacy`, not `/legal/privacy`), and doesn't match how Linear, Stripe, Vercel, and similar companies structure their own legal pages.
- **Keep both route groups' `layout.tsx` files distinct and merge only the leaf pages.** Not applicable here — both layouts were already reduced to pass-throughs (see [ADR-003 addendum](ADR-003-product-registry.md#addendum-product-pages-2026-07) for `(site)`), so there was no meaningful per-group behavior left to preserve by keeping them separate.
- **A single content registry unifying products and legal documents into one type.** Rejected: products and legal documents have genuinely different shapes (a `ProductRecord` has `status`/`accent`/`features`; a `LegalDocument` has `sections`/`lastUpdated`) and different page templates (`ProductHero` + capabilities + FAQ vs. a title + table of contents + sections). Forcing one shared type would blur a real domain distinction for no routing benefit — the merge only needed to happen at the routing layer, not the content-modeling layer.

## Consequences

- Adding a 4th product or a 7th legal document still needs zero new route files — the existing "one registry entry + translated copy" pattern holds for both content types, now resolved through a single page.
- A slug collision between a product and a legal document (e.g. if a future product were named `security`) would silently resolve to whichever registry is checked first (products, then legal). Not a concern today — the six requested slugs and three product slugs don't overlap — but worth a lint or startup check if the number of registries sharing this namespace grows.
- The page file itself is larger than either single-purpose version would have been, since it now contains two full view implementations (`ProductPageView`, `LegalPageView`) behind one resolver. This was judged better than the alternative of splitting the resolver logic and both views across multiple files for a distinction that only matters internally, not to any consumer of the route.

## Future considerations

If a third content type ever needs a flat top-level slug (e.g. a blog post at `/some-post-title`), it joins the same resolver rather than opening a third parallel dynamic route — that will not work, per this ADR's finding, and the same "check registry, render matching view, `notFound()` at the end" pattern extends cleanly.
