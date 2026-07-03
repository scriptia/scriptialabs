# Docker

Docker is the primary supported development workflow — `git clone` + `docker compose up` should work with nothing else installed.

## Dockerfile stages

```
base     node:22-alpine, workdir, telemetry disabled
deps     npm ci from the committed package-lock.json — cached unless package.json/lock change
dev      deps + full source, runs `npm run dev`; source is bind-mounted, this stage is for tooling only
build    deps + full source, runs `next build` (output: 'standalone')
runner   copies only .next/standalone, .next/static, and public/ from build — no npm, no dev deps, non-root user
```

`dev` is what `docker compose up` runs. `build` → `runner` is the production path, only invoked through the `prod` compose profile or a direct `docker build --target runner`.

## Compose services

| Service | Profile | Target | Port | Purpose |
|---|---|---|---|---|
| `app` | default | `dev` | 3000 | Next.js dev server, hot reload via bind mount |
| `storybook` | default | `dev` | 6006 | Storybook dev server, same bind mount |
| `app-prod` | `prod` | `runner` | 3000 | Production image — not started by a plain `docker compose up` |

```
docker compose up                       # dev: app + storybook, hot reload
docker compose --profile prod up app-prod   # production image
docker compose build app storybook       # rebuild dev images
docker compose --profile prod build app-prod  # rebuild production image
```

`app` and `storybook` mount `.:/app` plus an anonymous volume over `/app/node_modules`, so host edits are picked up immediately without the container's `node_modules` being shadowed by the host's (which likely doesn't exist, since Node isn't required on the host).

## Image size

The production image is the standalone Next.js output plus a pruned `node_modules` — roughly **~310MB**, versus **~1GB** for the dev image (which carries the full `node_modules`, including Storybook and its Vite toolchain). This is the reason `output: 'standalone'` is set in `next.config.ts` — without it, the production stage would ship the entire `node_modules` tree at runtime.

## Healthcheck

The `runner` stage has a `HEALTHCHECK` that hits `http://127.0.0.1:3000/` from inside the container using Node's built-in `fetch` (no extra `curl`/`wget` dependency needed in the minimal image). `docker compose --profile prod ps` will show `healthy` once the app responds.

## Lockfile

`package-lock.json` is committed. `npm ci` (used in the `deps` stage) requires it to be present and in sync with `package.json` — it fails fast on drift instead of silently re-resolving, which is what let a broken Storybook peer-dependency combination into the tree before this pass. If you see a "Found lockfile missing swc dependencies, patching..." warning during `next build`, that's Next.js noting that only the Linux/musl `@next/swc` binary is present in the lockfile (expected — we install inside an Alpine container) and is not an error.
