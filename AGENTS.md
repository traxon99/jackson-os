# Agent guide (jackson-os)

pnpm workspace on **Node 22** and **pnpm 9** (`packageManager` in root `package.json`). TypeScript is **strict** via `tsconfig.base.json`.

## Layout

- `apps/web` — Vite + React frontend; dev server proxies `/api` to the server.
- `apps/server` — Hono HTTP API served with `@hono/node-server`.
- `packages/core` — Shared pure types and domain logic (no I/O).

## Commands

Run from the repository root:

| Command          | What it does                                                                         |
| ---------------- | ------------------------------------------------------------------------------------ |
| `pnpm dev`       | Starts `apps/web` and `apps/server` in parallel (`web` proxies `/api` to port 8080). |
| `pnpm build`     | Builds every workspace package (`tsc` / `vite build`).                               |
| `pnpm test`      | Runs Vitest across the workspace (`vitest run`).                                     |
| `pnpm lint`      | Runs Biome check on the repo (`biome check .`).                                      |
| `pnpm typecheck` | Typechecks every package (`tsc --noEmit` where defined).                             |

## Core purity

`packages/core` must stay free of side effects and environment coupling:

- **Dependencies:** only `zod` belongs in `package.json` `dependencies`.
- **Imports:** production `.ts` files (not tests) must not import Node built-ins (`node:*` or bare `fs`, `path`, etc.), `hono`, `drizzle-orm`, or `better-sqlite3`.

`packages/core/src/purity.test.ts` enforces this in CI.

## Pull requests

Every PR must include a **How I verified** section: the commands you ran and enough output (or a short note) to show they passed. At minimum, run `pnpm lint`, `pnpm typecheck`, and `pnpm test` before opening; match whatever CI runs on `.github/workflows/ci.yml`.

## Further reading

- [docs/DECISIONS.md](docs/DECISIONS.md)
- [docs/SECURITY.md](docs/SECURITY.md)
- [docs/ADDING-A-SOURCE.md](docs/ADDING-A-SOURCE.md)
- [docs/PWA.md](docs/PWA.md)
- [docs/UI.md](docs/UI.md): design tokens, Paper Mono, widget building rules
