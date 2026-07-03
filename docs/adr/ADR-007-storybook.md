# ADR-007: Storybook

## Context

Storybook is the visual documentation and isolated-development layer for the component library — every populated component folder has a story. The original setup used `@storybook/nextjs` (the classic webpack-based framework) on Storybook 8.6. From a clean checkout, `docker compose build` failed immediately: `@storybook/addon-interactions@^8.6.0` resolved (with no lockfile to pin it) to a patch of `@storybook/test` incompatible with the peer version `@storybook/react`/`@storybook/nextjs` expected. After pinning exact versions to fix that, `npm run build-storybook` still failed with `TypeError: The 'compilation' argument must be an instance of Compilation`, thrown from webpack's `DefinePlugin`.

That error is a known symptom of two different webpack module instances being mixed — in this case, `@storybook/nextjs`'s builder calls into Next.js's own internally vendored/compiled webpack copy (`next/dist/compiled/webpack`) while also using the separately-installed `webpack` package for its own plugins. A class instance (`Compilation`) created by one copy fails an `instanceof` check against the other, even at the identical version. This was verified to reproduce identically on two different Next.js 15.x patch versions (15.1.6 and 15.5.20), ruling out a simple version-pinning fix — it's a structural incompatibility in how `@storybook/nextjs`'s webpack builder integrates with Next's internals, not a resolvable dependency conflict.

## Decision

**Migrate to `@storybook/nextjs-vite`**, which required upgrading Storybook itself from 8.6 to **10.4.6** (the Vite-based Next.js framework isn't published for Storybook 8). The Vite builder doesn't touch Next.js's webpack internals at all, sidestepping the conflict entirely rather than working around it.

This also meant:
- Dropping `@storybook/addon-essentials` and `@storybook/addon-interactions` — Storybook 9+ folded controls, actions, viewport, and interactions into core, so they're no longer separate addon packages.
- Adding `vite` as an explicit dependency (a peer requirement of `@storybook/nextjs-vite`).
- Adding `@storybook/react` as an explicit devDependency — story files import `Meta`/`StoryObj` types from it directly, and it had only been resolving by transitive luck through `@storybook/nextjs-vite`'s own dependency tree.
- Pinning `storybook`, `@storybook/nextjs-vite`, and `@storybook/react` to the exact same version (not `^` ranges) — the original incident started from a caret range resolving inconsistently with no lockfile to catch it; exact pins plus a committed lockfile close that gap for good.

Both `npm run storybook` (dev server) and `npm run build-storybook` (static build) were verified working after the migration, and the story index was confirmed to include all 11 story files with their expected entries.

## Alternatives considered

- **Pin an older Next.js patch to match whatever `@storybook/nextjs` 8.6 was originally tested against.** Tried (15.1.6) — the error reproduced identically, ruling this out as a viable fix.
- **Align webpack versions manually** (the generic fix for this class of error, per upstream Storybook issues). Not viable here: one of the two webpack copies is vendored *inside* `next`'s own package (`next/dist/compiled/webpack`), not a resolvable `node_modules` entry — there's no version to align it to.
- **Stay on the webpack builder and accept a broken `build-storybook`.** Rejected — the phase's explicit goal was a fully operational Storybook, and the user's instructions were to migrate to Vite if that's the correct long-term fix rather than apply a hack.

## Consequences

- The dev `node_modules` install dropped from ~906 packages to ~526 and the dev Docker image build time improved correspondingly — the webpack-based Next.js/Storybook toolchain duplication is gone.
- Story files' `meta` objects use an explicit `Meta` type annotation rather than `satisfies Meta` (see [engineering.md](../engineering.md) for why `satisfies` doesn't widen) — this was already necessary independent of the Vite migration, but got fixed in the same pass since both surfaced as typecheck failures together.
- Anyone extending Storybook config should reference Storybook 9/10 docs, not 8.x — the addon and configuration API shifted meaningfully (see the addon consolidation above).

## Future considerations

- If Storybook interaction/play-function testing is needed later, confirm it under the new core (`storybook/test` import path in v9+, not the removed `@storybook/addon-interactions` package).
- Track upstream `@storybook/nextjs` (webpack) compatibility if there's ever a reason to move back — as of this ADR there isn't one, since the Vite builder is fully functional and Vite is the direction Storybook's own tooling is moving.
