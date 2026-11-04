# Jim source

Jackson OS reads training data from Jim’s read-only `/v1` API ([traxon99/jim#734](https://github.com/traxon99/jim/issues/734)). Until those routes ship, development and CI use JSON fixtures under [`packages/core/src/jim/fixtures/`](../../packages/core/src/jim/fixtures/).

**Read only:** this source has no actions (ADR-022; [traxon99/jim#735](https://github.com/traxon99/jim/issues/735)). Jackson OS never starts or edits workouts in Jim.

## Environment

| Variable      | Purpose                                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------------------------- |
| `JIM_PAT`     | Bearer token for Jim (secret). When unset, the source and widgets report `disabled`.                              |
| `JIM_API_URL` | Base URL for Jim HTTP (not a secret). Default in [`.env.example`](../../.env.example): `https://jim-mcp.fly.dev`. |

### Read-only token

After [traxon99/jim#736](https://github.com/traxon99/jim/issues/736) ships: Jim **Settings → Advanced** → create a personal access token named e.g. “Jackson OS” with **read** scope only. Set `JIM_PAT` locally or via your host secrets (`fly secrets set JIM_PAT=…`). Never commit the token or log it in widget payloads.

## HTTP endpoints

| Endpoint                    | Client module                                                                                      | Tracking issue                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `GET /v1/status`            | [`packages/core/src/jim/api/status.ts`](../../packages/core/src/jim/api/status.ts)                 | [traxon99/jim#737](https://github.com/traxon99/jim/issues/737)           |
| `GET /v1/weeks`             | [`packages/core/src/jim/api/weeks.ts`](../../packages/core/src/jim/api/weeks.ts)                   | [traxon99/jim#738](https://github.com/traxon99/jim/issues/738)           |
| `GET /v1/streak`            | [`packages/core/src/jim/api/streak.ts`](../../packages/core/src/jim/api/streak.ts)                 | [traxon99/jim#738](https://github.com/traxon99/jim/issues/738)           |
| `GET /v1/workouts`          | [`packages/core/src/jim/api/workouts.ts`](../../packages/core/src/jim/api/workouts.ts)             | [traxon99/jim#739](https://github.com/traxon99/jim/issues/739)           |
| `GET /v1/workouts/:id`      | [`packages/core/src/jim/api/workout-detail.ts`](../../packages/core/src/jim/api/workout-detail.ts) | [traxon99/jim#739](https://github.com/traxon99/jim/issues/739)           |
| `GET /v1/prs`               | [`packages/core/src/jim/api/prs.ts`](../../packages/core/src/jim/api/prs.ts)                       | [traxon99/jim#740](https://github.com/traxon99/jim/issues/740)           |
| `GET /v1/lifts`             | [`packages/core/src/jim/api/lifts.ts`](../../packages/core/src/jim/api/lifts.ts)                   | [traxon99/jim#741](https://github.com/traxon99/jim/issues/741)           |
| `GET /v1/body-measurements` | [`packages/core/src/jim/api/body.ts`](../../packages/core/src/jim/api/body.ts)                     | [traxon99/jim#742](https://github.com/traxon99/jim/issues/742)           |
| `GET /v1/plan`              | [`packages/core/src/jim/api/plan.ts`](../../packages/core/src/jim/api/plan.ts)                     | [traxon99/jim#742](https://github.com/traxon99/jim/issues/742) _(guess)_ |
| `GET /v1/dpr`               | [`packages/core/src/jim/api/dpr.ts`](../../packages/core/src/jim/api/dpr.ts)                       | [traxon99/jim#742](https://github.com/traxon99/jim/issues/742) _(guess)_ |

When an endpoint lands, compare its live JSON to the Zod schema and update fixtures if they differ.

## Datasets, refresh, and widgets

Defined in [`packages/core/src/jim/index.ts`](../../packages/core/src/jim/index.ts).

| Dataset key | Refresh (`everyMs` / stale)     | Widget id    | Widget title |
| ----------- | ------------------------------- | ------------ | ------------ |
| `status`    | 5m / 15m stale                  | `jim.status` | jim          |
| `training`  | 15m / 1h stale (weeks + streak) | `jim.week`   | training     |
| `workouts`  | 15m / 1h stale                  | `jim.recent` | workouts     |
| `prs`       | 1h / 6h stale                   | `jim.prs`    | prs          |
| `lifts`     | 6h / 24h stale                  | `jim.lifts`  | lifts        |
| `body`      | 6h / 24h stale                  | `jim.body`   | body         |
| `next`      | 30m / 2h stale (plan + dpr)     | `jim.next`   | next         |

React views: [`apps/web/src/widgets/jim/`](../../apps/web/src/widgets/jim/).

## Schema fields to re-check _(guess)_

These fields match fixture examples but are not confirmed against production Jim responses yet:

- **`/v1/status`:** `activeWorkout`, `tokenScope`
- **`/v1/plan`:** `scheduled[].programName`, `next.date` nullability, `webUrl` on scheduled rows
- **`/v1/dpr`:** entire `block` shape (`lastDecision`, nullable `intensity`, nullable `e1rm` / `goal`)
- **`/v1/lifts`:** `selection`, `predicted`, per-point `series` density
- **`/v1/body-measurements`:** `change` on a kind, long `points` arrays
- **`/v1/workouts`:** `gym`, `prCount`, `webUrl`
- **`/v1/prs`:** `tier`, `previousValue` nullability

Mark items off after comparing to the shipped endpoint.

## E2E

[`apps/web/e2e/jim-widgets.spec.ts`](../../apps/web/e2e/jim-widgets.spec.ts) stubs auth, layout, sources, and widget routes at 393×852 and 1440×900 using payloads in [`apps/web/e2e/fixtures/jim/`](../../apps/web/e2e/fixtures/jim/).
