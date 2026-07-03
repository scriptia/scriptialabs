# ADR-001: Project Architecture

## Context

Scriptia Labs' corporate site is the shared platform for three (and growing) products — Scriptia, Padelco, Voice Agents. The site needs to outlive any single product's roadmap: new products will be added, existing ones will change status (teaser → live → possibly archived), and the same navigation, SEO, and legal infrastructure needs to serve all of them consistently. This is being built as an application platform, not a static marketing site.

## Decision

Build on Next.js App Router with a strict layering:

- **`src/content`** is the single source of truth for anything that would otherwise be a hardcoded string, href, or product fact in JSX — products, navigation, legal documents, SEO defaults, site metadata. It's typed data, not copy.
- **`src/design`** owns tokens and theme mapping; components consume the semantic layer, never raw values.
- **`src/lib`** holds cross-cutting concerns (i18n, routing, SEO, motion, validation) as pure-ish utilities, not tied to any one page.
- **`src/components`** is a reusable library with no knowledge of specific pages — page composition happens in `src/app`.
- SEO infrastructure (`sitemap.ts`, metadata builders, JSON-LD) was built before any real page exists, driven entirely by the content layer, so adding a page is "add a content entry," not "also go update the sitemap by hand."

## Alternatives considered

- **Content colocated with components** (each component owns its copy/links inline). Rejected: makes i18n and cross-product consistency (e.g. "does every product page have the same nav") much harder to audit or enforce, and duplicates the same strings across locales inconsistently over time.
- **A CMS from day one.** Rejected for now: the product catalog is small (3 products) and changes infrequently; a typed TypeScript content layer gives full type safety and zero infrastructure cost. Revisit if/when non-engineers need to edit content directly.
- **Per-product subdomains or separate repos.** Rejected: the explicit goal is one shared platform presenting all products consistently, not three independent sites.

## Consequences

- Adding a new product means adding one entry to `src/content/products` (typed against `ProductRecord`) plus translations — navigation, sitemap, and routing all pick it up automatically.
- The tradeoff is more indirection for a very small team: a new contributor has to learn "content lives over there, not in the component" before they're productive. Documented in [contributing.md](../contributing.md) to shorten that ramp-up.
- Because this layering was built ahead of real pages, there was a real risk of the abstractions being wrong for content nobody had written yet. The engineering audit and this production-readiness pass exist specifically to catch that early, via full validation rather than assuming "it's marked complete."

## Future considerations

- If the product catalog grows past ~10, the current `ProductRecord['id']`-literal-union approach (used for `Record<ProductRecord['id'], ProductRecord>`) will get unwieldy and should move to a plain `string` key with runtime validation instead of a compile-time literal union.
- Revisit the "no CMS" decision if marketing/non-engineering contributors need to edit content without a PR.
