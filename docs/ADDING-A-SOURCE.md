# Adding a source

This walkthrough shows how a new data source is wired today, using the shipped **`demo`** source as the reference. To add a fictional **`weather`** source, mirror the same files and registration points; only the paths under `packages/core/src/weather/` and widget ids would use the `weather` prefix.

## 1. Adapter and datasets (`packages/core`)

Create `packages/core/src/weather/index.ts` modeled on [`packages/core/src/demo/index.ts`](../packages/core/src/demo/index.ts):

- Export a `SourceAdapter` with a stable `id` (e.g. `weather`), `configSchema`, `datasets`, and optional `actions`.
- Each dataset needs a Zod `schema`, `refresh` intervals, and a pure `fetch` that respects `ctx.signal`.

Add a contract test like [`packages/core/src/demo/contract.test.ts`](../packages/core/src/demo/contract.test.ts):

```typescript
import { runAdapterContract } from '../testing/contract.js';
import { weatherAdapter } from './index.js';

runAdapterContract(weatherAdapter, {
  config: {},
  secrets: ['example-secret'],
});
```

Run it with the rest of the suite:

```bash
pnpm test packages/core/src/weather/contract.test.ts
```

Export registration from [`packages/core/src/index.ts`](../packages/core/src/index.ts) (one line: export `registerWeather` next to `registerDemo`).

## 2. Server registry and scheduler

In [`apps/server/src/index.ts`](../apps/server/src/index.ts):

- Call `registerWeather(registry)` next to `registerDemo(registry)`.
- Extend `isSourceEnabled` if the source should be gated on env vars (see how `jim`, `github`, and `portfolio` map in that function today).

If the source needs secrets, add keys to [`apps/server/src/config.ts`](../apps/server/src/config.ts) (`configSchema`, `SECRET_KEYS`, and `sourceStatus` when the source is optional).

**Registry line to change:** `registerDemo(registry)` → also `registerWeather(registry)`.

**Config line to change:** add env keys to `configSchema` and wire `sourceStatus` when enablement depends on secrets.

## 3. Widget definitions (core)

Register widgets on the same registry object, as in `registerDemo` inside [`packages/core/src/demo/index.ts`](../packages/core/src/demo/index.ts) (`demoWidgets` + `registry.registerWidget`).

Widget ids must match what the API exposes under `/api/widgets/:id` (see [`apps/server/src/routes/widgets.ts`](../apps/server/src/routes/widgets.ts)).

## 4. Web UI

Dashboard React components are tracked separately (issue S66). Until they ship, define widgets in core (step 3) and validate payloads via `/api/widgets/:id` and the tests in [`apps/server/src/routes/widgets.test.ts`](../apps/server/src/routes/widgets.test.ts).

When adding UI, colocate components under `apps/web/src/widgets/<source-id>/` and map widget ids to components in the web widget registry module added in that issue.

## 5. Verify

After adding `weather`, grep every identifier the doc mentions against the tree:

```bash
rg 'weatherAdapter|registerWeather|weather\.' packages/core apps/server
```

Every path linked above must exist before you merge the doc change; for a new source, those paths are the files you added in steps 1–4.
