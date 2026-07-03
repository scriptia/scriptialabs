# Architecture

## Routing

The app uses Next.js App Router with a locale-prefixed route tree:

```
src/app/
  layout.tsx            Root layout: <html>/<body>, next-intl provider
  page.tsx               Redirects "/" to the default locale
  not-found.tsx          Locale-independent 404 (see "Why not-found.tsx has no i18n" below)
  error.tsx               Locale-independent error boundary (same reason)
  robots.ts, sitemap.ts, manifest.ts, opengraph-image.tsx
  [locale]/
    layout.tsx                    Resolves and validates the locale, renders Navbar/Footer
    (site)/
      layout.tsx                  Pass-through — pages compose their own section layout
      page.tsx                    Homepage
      [slug]/page.tsx             Every product page AND every legal page (one route, see below)
```

`middleware.ts` runs next-intl's routing middleware on every path except `api`, `_next`, `_vercel`, and static files, so every real page is served under `/en`, `/es`, or `/ca`.

### Why `not-found.tsx` and `error.tsx` don't use next-intl

Next.js generates static `/404` and `/500` fallback pages at build time, outside any request context. `getLocale()`/`getMessages()` need request scope (headers/cookies) and throw when called there. The root layout falls back to the default locale when that happens (see `resolveLocale()` in `src/app/layout.tsx`), but the root `not-found.tsx`/`error.tsx` themselves are written as plain, translation-free components so they render correctly even in that request-free context. They're still nested inside the root layout's `<html>`/`<body>` — they don't render their own.

### Typed routes are off

`next.config.ts` does not enable `typedRoutes`. The nav/content model (`src/content/navigation`, `src/content/products`) types every `href` as a plain `string`, sourced from data — not a literal route union. `typedRoutes` requires the latter. See [ADR-006](adr/ADR-006-routing.md).

## Request lifecycle (locale layout)

1. `middleware.ts` matches the request and resolves/redirects to a locale-prefixed path.
2. `src/app/layout.tsx` resolves the locale and wraps children in `NextIntlClientProvider`.
3. `src/app/[locale]/layout.tsx` validates the `[locale]` param against `routing.locales`, fetches translation namespaces, and renders `Navbar`/`Footer` around `children`.
4. The `(site)` route group layout is a pass-through — pages compose their own section layout rather than sharing one imposed wrapper.

## Folder structure

```
src/app          Route tree, metadata, route infrastructure
src/components    Component library (see design-system.md)
src/content       Typed content: products, navigation, SEO, routes, legal, site
src/design        Design tokens and Tailwind theme mapping
src/lib           i18n, routing, SEO, motion, validation, and generic utils
src/messages      Localized message payloads (en / es / ca)
src/styles        Global CSS, token → CSS variable bootstrap
```

`src/content` is the single source of truth for anything that would otherwise be a hardcoded string or href in JSX — navigation items, product metadata, legal document registry, SEO defaults. Components read from it; they don't define their own copy.

## Product registry

`src/content/products/index.ts` models each product (`scriptia`, `padelco`, `voice-agents`) with a `ProductStatus` (`draft | teaser | alpha | beta | live | deprecated | archived`) and an `availability` (`public | private | teaser`), so a product can exist in the registry, drive navigation and sitemap generation, and still be excluded from indexing (`seo.indexable: false`) before it's publicly ready. See [ADR-003](adr/ADR-003-product-registry.md).

## Legal document registry

`src/content/legal/index.ts` models each legal page (`privacy`, `terms`, `cookies`, `contact`, `security`, `aiPolicy`) as a `LegalDocument` — a slug, a `lastUpdated` date, and an ordered list of section ids. The registry owns structure only; every section's actual title and body paragraphs live in the message files (`legal.<key>.sections.<id>.{title,body}`), fetched via `t.raw()` for the paragraph array. All six documents are company-wide, not per-product — they explicitly state they cover Scriptia, Padelco, Voice Agents, and any future product, so a new product never needs its own legal pages.

## Product and legal pages — one route

`/scriptia`, `/padelco`, `/voice-agents`, `/privacy`, `/terms`, `/cookies`, `/contact`, `/security`, and `/ai-policy` are all served by **one** route: `src/app/[locale]/(site)/[slug]/page.tsx`. This isn't a simplification for its own sake — Next.js does not allow two different dynamic route files to resolve the same URL pattern, even across different route groups, and products and legal pages share exactly one flat top-level slug namespace. See [ADR-008](adr/ADR-008-legal-routing.md) for the full story, including the two build errors that led here.

The page resolves `slug` against the product registry first, then the legal registry, rendering whichever view matches (`ProductPageView` or `LegalPageView`) and calling `notFound()` if neither does. `generateStaticParams` returns the union of both registries' slugs. Adding a fourth product or a seventh legal document needs a registry entry and translated copy — no new route file, for either content type.

Every product page shares the same section structure (hero, overview, capabilities, how it works, why it exists, current status, FAQ, CTA) driven by `ProductHero` (`src/components/product/`), `Timeline`, and `Accordion`, themed only by each product's `accent` token. Every legal page shares `LegalDocumentView` (`src/components/legal/`) — title, last-updated date, an optional sticky table of contents, and sections.

## SEO infrastructure

`src/lib/seo/` builds metadata, canonical URLs, and JSON-LD from the content layer. `src/app/sitemap.ts` composes company routes, legal routes, and non-archived product routes across all locales with `alternates.languages`. This is deliberately built ahead of the pages it will serve — see [ADR-001](adr/ADR-001-project-architecture.md) for why.
