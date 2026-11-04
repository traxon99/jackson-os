# Adding a source

This walkthrough uses the shipped **`jim`** source as the reference. A new source follows the same registration points; swap the `jim` prefix for your source id.

## Where things live

| Layer                               | Location                                                                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Config + HTTP client                | [`packages/core/src/jim/config.ts`](../packages/core/src/jim/config.ts), [`packages/core/src/jim/client.ts`](../packages/core/src/jim/client.ts)        |
| Endpoint clients + Zod schemas      | [`packages/core/src/jim/api/`](../packages/core/src/jim/api/) (one module per route)                                                                    |
| JSON fixtures (offline dev + tests) | [`packages/core/src/jim/fixtures/`](../packages/core/src/jim/fixtures/)                                                                                 |
| Adapter, datasets, widget defs      | [`packages/core/src/jim/index.ts`](../packages/core/src/jim/index.ts)                                                                                   |
| Server enablement + secrets         | [`apps/server/src/sources.ts`](../apps/server/src/sources.ts), [`apps/server/src/config.ts`](../apps/server/src/config.ts) (`JIM_PAT`, `JIM_API_URL`)   |
| Dashboard React views               | [`apps/web/src/widgets/jim/`](../apps/web/src/widgets/jim/) (registered in [`apps/web/src/widgets/registry.ts`](../apps/web/src/widgets/registry.ts))   |
| Widget E2E (stubbed API)            | [`apps/web/e2e/jim-widgets.spec.ts`](../apps/web/e2e/jim-widgets.spec.ts), fixtures under [`apps/web/e2e/fixtures/jim/`](../apps/web/e2e/fixtures/jim/) |

Export registration from [`packages/core/src/index.ts`](../packages/core/src/index.ts) (`registerJim` next to `registerDemo`).

## Fixtures-first order

Build and verify in this order so nothing waits on a live upstream:

1. **Schema + fixture** — Add or extend Zod in `packages/core/src/jim/api/<route>.ts` and drop a matching JSON file in `packages/core/src/jim/fixtures/`. Contract tests parse fixtures through the schema.
2. **Client** — Thin `jimGet` wrapper in the api module; keep all HTTP on `ctx.fetch` (never global `fetch`) so the purity test stays green.
3. **Dataset** — Wire `fetch` + `refresh` in [`packages/core/src/jim/index.ts`](../packages/core/src/jim/index.ts); add [`packages/core/src/jim/datasets.test.ts`](../packages/core/src/jim/datasets.test.ts) coverage when behavior is non-trivial.
4. **Widget** — Add a `WidgetDef` on the adapter and a React view under `apps/web/src/widgets/jim/`.
5. **E2E** — Copy core fixture data into `apps/web/e2e/fixtures/jim/` as widget payloads (`{ state, data, fetchedAt, stale }`), stub `/api/widgets/jim.*` like [`apps/web/e2e/layout.spec.ts`](../apps/web/e2e/layout.spec.ts), and run `pnpm --filter web e2e`.

## Server registry and scheduler

In [`apps/server/src/index.ts`](../apps/server/src/index.ts):

- Call `registerJim(registry)` next to `registerDemo(registry)`.
- `isSourceEnabled` / `sourceStatus` treat `jim` as enabled when `JIM_PAT` is set (see [`apps/server/src/config.ts`](../apps/server/src/config.ts)).

Secrets: `JIM_PAT` is listed in `SECRET_KEYS`; `JIM_API_URL` is a normal config URL (default `https://jim-mcp.fly.dev`).

## Upstream errors and Retry-After

Jim HTTP failures become [`UpstreamError`](../packages/core/src/errors.ts) in [`packages/core/src/jim/client.ts`](../packages/core/src/jim/client.ts) (status, optional `code`, optional `retryAfterMs` from the `Retry-After` header).

The scheduler ([`apps/server/src/scheduler/run-dataset.ts`](../apps/server/src/scheduler/run-dataset.ts)) catches `UpstreamError`, stores a formatted message via `formatUpstreamError`, and returns `retryAfterMs` so the next fetch waits. Widget routes expose that string on `{ state: 'error', error }` and keep the previous snapshot on `lastGood` when present ([`apps/server/src/routes/widgets.ts`](../apps/server/src/routes/widgets.ts)).

## Widget API

Widget ids must match `/api/widgets/:id` (see [`apps/server/src/routes/widgets.test.ts`](../apps/server/src/routes/widgets.test.ts)). Dashboard titles come from each `WidgetDef.title` in core.

## Verify

After editing docs or adding a source, grep the identifiers this file names:

```bash
rg 'registerJim|jimAdapter|jimWidgets|JIM_PAT|JIM_API_URL' packages/core apps/server apps/web
```

Every linked path must exist. For Jim-specific endpoints, env vars, and refresh intervals, see [docs/SOURCES/jim.md](SOURCES/jim.md).
