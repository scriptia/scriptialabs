# ADR-004: Internationalization

## Context

The site needs to serve English, Spanish, and Catalan from day one — not bolted on after an English-only launch, since Catalan in particular is a market/audience commitment, not a "nice to have" locale. Every route, every piece of navigation, and every metadata output needs to exist in all three languages consistently.

## Decision

- **next-intl**, with `localePrefix: 'always'` — every route is locale-prefixed (`/en`, `/es`, `/ca`), including the default locale, so there's never ambiguity about which locale a URL is for.
- `src/lib/i18n/routing.ts` defines the routing config via `defineRouting()` and calls `createNavigation()` to produce locale-aware `Link`, `useRouter`, `usePathname`, and `redirect` — components import these instead of the bare `next/link`/`next/navigation` equivalents, so locale-prefixing is automatic rather than manually string-templated at every call site.
- Messages live in `src/messages/{en,es,ca}/index.ts` as structured TypeScript objects (not flat JSON), grouped by namespace (`common`, `navigation`, `products`, …). Key sets are kept identical across all three locales — verified during the engineering audit with zero drift.
- `src/middleware.ts` runs next-intl's middleware on every path except `api`, `_next`, `_vercel`, static files, and `/internal` (which is not localized — see [ADR-010](ADR-010-internal-panel.md)). Note the location: middleware must sit next to `app`, which in this project means inside `src/`.

## Alternatives considered

- **Locale as a query param or cookie only, no URL prefix.** Rejected: hurts SEO (search engines need distinct, crawlable URLs per locale) and makes sharing a link locale-ambiguous.
- **Flat JSON message files.** Rejected in favor of TypeScript objects: namespacing is more ergonomic, and TypeScript catches a malformed message file at compile time instead of at runtime.
- **Default locale unprefixed (`/` for English, `/es` for Spanish).** Rejected: `localePrefix: 'always'` keeps every locale symmetric — no special-casing English in routing logic, canonical URL generation, or the sitemap.

## Consequences

- Every internal link must go through the locale-aware `Link`/`useRouter`, not `next/link` directly — a plain `next/link` usage for an internal route is a bug (it won't be locale-prefixed). This was already caught and fixed once during the audit (`route-states.tsx` was importing `useRouter` from bare `next-intl`, which doesn't export it — it needs to come from the app's own `@/lib/i18n/routing`).
- Adding a fourth locale means: add it to `routing.locales`, add a `src/messages/<locale>/index.ts` with every existing key translated, and the rest (routing, sitemap alternates, navigation) follows automatically.
- A few hardcoded English default strings still exist as fallback `aria-label` values in a couple of components (`LanguageSwitcher`, `Breadcrumb`) — flagged in the engineering audit as a remaining gap, not yet fixed as of this ADR.

## Future considerations

- If translation work moves to non-engineers, the TypeScript message format will need a companion export/import path (e.g. to a spreadsheet or a lightweight translation management tool) rather than requiring a PR per string change.
