# ADR-006: Routing

## Context

Next.js 13+ offers `typedRoutes`, which makes `<Link href>` and `redirect()` calls compile-time-checked against the actual set of routes in the app — a genuinely good feature for catching broken internal links before runtime. It was enabled in the original `next.config.ts`. It was also, at the time of the production-readiness pass, breaking the production build.

## Decision

**`typedRoutes` is disabled**, with a comment in `next.config.ts` explaining why.

The reason isn't a bug in the feature — it's a real mismatch with how this codebase models navigation. `src/content/navigation` and `src/content/products` type every `href` as a plain `string`, sourced from data (so a new nav item or product doesn't require a code change, just a content entry). `typedRoutes` wants `href` to be a `Route` — a literal union of known, existing route strings. Those two things are incompatible: a data-driven `string` can never satisfy a literal-route-union constraint, because TypeScript can't know at compile time which strings in that data are valid routes.

This showed up concretely: with `typedRoutes` on, the build failed on `src/components/layout/layout.tsx:102` (`<Link href={action.href}>` where `action.href` is `string`), and would have failed on every other data-driven `Link` in the app the same way. The alternative — casting every such `href` to `Route` at each call site — was rejected as it defeats the point of the feature (a cast silences exactly the check `typedRoutes` exists to perform) while adding noise throughout the codebase.

## Alternatives considered

- **Cast every data-driven `href` to `Route`.** Rejected: this makes `typedRoutes` a no-op wherever it matters most (the dynamically-generated nav/product links), while still paying its build-time cost and adding `as Route` casts throughout `src/components` and `src/content`.
- **Type the content layer's `href` fields as a literal route union instead of `string`.** This is the "do it properly" option, deferred rather than rejected — see Future considerations.
- **Leave `typedRoutes` enabled and fix only the specific build failure encountered.** Rejected: the same failure mode would recur at every other data-driven link (navigation, footer, product menu), not just the one that happened to break the build first.

## Consequences

- Internal links driven by `src/content` data are not compile-time verified against real routes today. A typo in a content file's `href` would only surface as a 404 at runtime, not a build failure.
- Everything else about the routing setup is unaffected — locale-prefixed routes, `middleware.ts`, and `createNavigation()`'s locale-aware `Link`/`useRouter` all work exactly as before.

## Future considerations

Re-enabling `typedRoutes` properly requires typing the content layer's routes as literals, not plain strings — e.g. deriving `NavigationItem['href']` from `keyof typeof canonicalRoutes` (already defined in `src/lib/routing/routes.ts`) instead of `string`. That's a real but bounded piece of work: it touches `src/content/navigation`, `src/content/products`, and every component that threads a content-sourced `href` through to `Link`. Worth doing once the homepage phase starts adding real routes, since that's when a broken internal link actually starts costing something.
