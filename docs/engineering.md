# Engineering

## Type safety

`tsconfig.json` runs in `strict` mode. There is no `any` or `as any` anywhere in `src/` — keep it that way. If you hit a type you can't express cleanly, that's usually a sign the underlying data model needs a proper type, not an escape hatch. Two patterns worth knowing before you hit them:

- **`satisfies` doesn't widen.** `const x = {...} satisfies SomeType` keeps `x`'s *inferred* (often narrower) type, not `SomeType`. If you need the declared type — including its optional fields — annotate explicitly (`const x: SomeType = {...}`) instead of relying on `satisfies` alone. This bit the product registry and nav model before this pass; both are now explicitly annotated.
- **Route params from Next's generated types are `string`, not your locale union.** `LayoutProps`/`PageProps` type `params.locale` as plain `string`. Narrow it yourself after validating against `routing.locales`, don't widen your own types to match.

## Quality gates

```
npm run lint             # ESLint, 0 errors required
npm run typecheck        # tsc --noEmit, 0 errors required
npm run build             # next build (production)
npm run build-storybook   # Storybook production build
```

All four are green on `main` and are the bar for any change. Run them via `docker compose run --rm app <script>` if you don't have Node installed locally — that's the supported path.

## Dependency policy

- Every dependency should have a real, grep-able consumer in `src/` (or be config-level tooling like `autoprefixer`/`tailwindcss-animate`, which are used from config files, not imported in `src/`). `class-variance-authority` was removed during the production-readiness pass for exactly this reason — installed, never imported.
- Don't bump a major version opportunistically. `next`, `eslint`, `tailwindcss`, and `typescript` are all at least one major behind latest as of this writing — that's a deliberate, scheduled decision, not neglect. Major bumps (especially Tailwind 3→4, which changes the config format) get their own reviewed change, not a drive-by in an unrelated PR.
- Run `npm audit` after any dependency change. As of this writing there are 5 moderate-severity advisories, all transitive inside `next`'s own dependency tree (a PostCSS XSS advisory with no fix currently available upstream) — known, accepted, not actionable from this repo.

## Conventions

- Server components by default. Add `'use client'` only when the component actually needs interactivity, state, or a browser API.
- Content lives in `src/content` as typed data, not inline JSX strings or hrefs.
- Translations live in `src/messages/{en,es,ca}` as structured objects, not scattered literals — see [ADR-004](adr/ADR-004-internationalization.md).
- A component that's exported gets a story and is expected to actually work. Half-finished primitives (stub markup with no behavior) get removed, not left in the barrel — see [ADR-002](adr/ADR-002-design-system.md).

## Commit hygiene

- `package-lock.json` is committed and is the source of truth for installs. The Dockerfile uses `npm ci`, which fails fast on a lockfile/package.json mismatch — if you change a dependency, regenerate the lockfile (`docker compose run --rm app npm install`) in the same change.
- `storybook-static/` and `.next/` are build output, not source — both are gitignored. Only `storybook-static/.gitkeep` is tracked, to keep the directory present for local builds.
