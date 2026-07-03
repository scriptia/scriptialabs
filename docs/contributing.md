# Contributing

## Local workflow

```
git clone <repo>
docker compose up
```

No local Node install needed. The app is at `localhost:3000`, Storybook at `localhost:6006`, both hot-reloading from the bind-mounted source tree. If you do have Node 22 locally and prefer running things outside Docker, `npm install && npm run dev` works too — just make sure `npm run lint`/`typecheck`/`build` still pass inside Docker before you push, since that's what's verified.

## Before opening a PR

```
docker compose run --rm app npm run lint
docker compose run --rm app npm run typecheck
docker compose run --rm -e NODE_ENV=production app npm run build
docker compose run --rm app npm run build-storybook
```

All four need to be clean. None of them are optional or "warnings are fine" — the bar as of this pass is 0 lint errors and 0 type errors on `main`, keep it there.

## Where things go

| You're adding... | It goes in... |
|---|---|
| A reusable UI component | `src/components/<category>/`, with a co-located `.stories.tsx` |
| Copy, nav items, product info | `src/content/<area>/` as typed data — never inline JSX strings |
| A translated string | `src/messages/{en,es,ca}/index.ts` — same key in all three |
| A design token | `src/design/tokens` → `src/design/theme` → `tailwind.config.ts`, in that order |
| A route/page | `src/app/[locale]/(site)/` or `(legal)/`, once that phase starts |
| A utility | `src/lib/<area>/`, only if it's actually shared — don't add a one-off helper file for a single call site |

## Component standards

- Server component by default; `'use client'` only when it needs interactivity.
- Every exported component has a story that exercises its real props — not a placeholder string passed where a structured prop is expected.
- If a component's behavior is genuinely unfinished, it doesn't get exported. See [ADR-002](adr/ADR-002-design-system.md) for the reasoning (and what happened to `Dropdown`/`Popover` because of it).

## Adding or upgrading a dependency

Regenerate the lockfile in the same change: `docker compose run --rm app npm install`, commit the resulting `package-lock.json` diff alongside the `package.json` change. Don't bump a major version as a side effect of an unrelated change — see [docs/engineering.md](engineering.md#dependency-policy).

## When the architecture doesn't fit

If implementing something reveals the current architecture is wrong for it, stop and write it up (an ADR, or at minimum a clear PR description) before working around it. This repo is meant to hold up for years — a shortcut that trades structure for speed here compounds.
