# Architecture decision records

Short ADRs for jackson-os foundation choices. Parent index: GitHub issue #1.

## ADR-001 — Repo layout

### Context

The project combines a web UI, HTTP API, shared domain logic, and (soon) database access. We need a layout that keeps boundaries clear and supports independent builds and tests.

### Decision

Use a **pnpm monorepo** with `apps/web`, `apps/server`, `packages/core`, and `packages/db`.

### Alternatives rejected

- **Single Next.js app** — Would merge UI and API into one framework and runtime, making it harder to enforce pure domain code in `packages/core` and to serve a static PWA from a separate Hono process.

### Consequences

- Workspace scripts at the root (`pnpm lint`, `pnpm test`, etc.) apply to all packages.
- Shared types and logic live in `packages/core`; persistence stays out of core per purity rules.
- New apps or packages follow the existing `apps/*` and `packages/*` pattern.

### Homelab migration risk

None — the repo layout is host-agnostic.

## ADR-002 — Backend

### Context

The server exposes HTTP APIs, serves static frontend assets, holds sessions, and will run schedulers and SQLite I/O. We want a small, explicit stack on a long-lived Node process.

### Decision

Run the API with **Hono on Node 22**, written in **TypeScript**, using `@hono/node-server`.

### Alternatives rejected

- **Next.js route handlers** — Couples the API to the Next/Vercel runtime and blurs the SPA vs API split.
- **Fastify** — Capable, but Hono’s lightweight routing and middleware fit the single-container model with less ceremony.

### Consequences

- One Node process can serve `/api`, static files, and in-process jobs.
- Deployment targets any environment that runs Node 22 (Fly VM, Docker on homelab, etc.).
- Framework-specific code stays in `apps/server`, not in `packages/core`.

### Homelab migration risk

None — Hono on Node runs the same in Docker Compose as on Fly.io.

## ADR-003 — Frontend

### Context

The product is a single-user authenticated dashboard, not a public marketing site needing SEO or SSR. Offline-friendly caching matters for a personal PWA.

### Decision

Build the UI as a **React + Vite SPA**, output **static files**, and **serve them from the Hono server** (same origin as the API).

### Alternatives rejected

- **Next.js** — SSR and server components are unnecessary for this use case; a static SPA is simpler to cache, version, and ship as PWA assets behind one container.

### Consequences

- `apps/web` uses Vite dev server with `/api` proxied to the backend during development.
- Production is static `dist/` assets plus API routes on one host — no separate frontend CDN required (Cloudflare can still proxy the origin).
- Client routing is entirely in the browser; auth and data go through `/api`.

### Homelab migration risk

None — static build artifacts are portable; only the server’s static file mount path must match in Compose.

## ADR-004 — Storage

### Context

Data is for a single operator: moderate volume, relational queries, and strong preference for one container and one bill. Managed Postgres adds cost and another service to operate.

### Decision

Use **SQLite** via **Drizzle ORM** and **`better-sqlite3`**, with the database file on a **persistent volume mounted at `/data`**.

### Alternatives rejected

- **Postgres / Supabase** — Another process to run, back up, and pay for; disproportionate for one user and a single-writer workload.

### Consequences

- Schema and queries live in `packages/db`; the server opens the file under `/data`.
- Backups are file-level (copy or snapshot the volume); **Litestream** is a documented later option for continuous replication to object storage without changing the app model.
- Migrations run as part of deploy or startup conventions in the server layer.

### Homelab migration risk

Low — copy the SQLite file (or restore from Litestream) onto the homelab volume; ensure `/data` permissions and backup cadence match the Fly volume habit.

## ADR-005 — Hosting

### Context

We want one deployable unit with persistent disk, optional edge protection, and a path from a managed VM to a home server without rewriting the app.

### Decision

Ship **one Docker container** that runs the Node server and serves the built SPA.

- **Phase 1:** **Fly.io** — small shared VM plus a **1 GB volume** for `/data`.
- **Phase 2:** **Homelab** — same image via **Docker Compose**, egress via **Cloudflare Tunnel**.

### Alternatives rejected

- **Cloudflare Workers / Pages** — D1, KV, and Workers cron are not a drop-in substitute for a plain Node container and SQLite file on disk.
- **Vercel** — No persistent disk and cron limits conflict with SQLite-on-volume and in-process scheduling.

### Consequences

- All host-specific configuration lives in env vars and `deploy/` (not in `packages/core`).
- Fly-specific `fly.toml` and volume attachments are Phase 1 only; Compose and tunnel config are Phase 2 additions, not app rewrites.
- Scaling story is vertical (bigger VM / homelab box), not multi-region serverless.

### Homelab migration risk

Moderate until Phase 2 is done — Fly volume attach and `fly.toml` must be replaced with Compose volume mounts and tunnel ingress; the container image itself should move unchanged.

## ADR-006 — Auth

### Status

Proposed, awaiting Jackson.

### Context

The app is single-user and runs as a PWA. Authentication must work reliably in the browser (including installed iOS standalone) without adding another always-on identity container or an extra login hop before the app’s own session.

### Decision

Use **self-built passkey authentication** with **SimpleWebAuthn** and **server-side sessions** stored and validated in the Hono server.

### Alternatives rejected

- **Pocket ID / Authelia / Authentik** — Each adds another container and an extra login step in the PWA flow; SSO across homelab apps may be revisited later but is not required for M0.

### Consequences

- WebAuthn ceremony and session cookies are implemented in `apps/server`; no third-party IdP SDK in `packages/core`.
- Session rotation, logout, and credential management are first-class API concerns.
- Homelab SSO is a future option without blocking the passkey-first model.

### Homelab migration risk

None for the auth model itself — sessions and credentials live in SQLite; only env secrets and cookie settings must match in Compose.

## ADR-007 — Edge layer

### Status

Pending spike #14.

### Context

Traffic should terminate with modern TLS, basic WAF, and rate limiting without rewriting the app. A second access layer (Cloudflare Access) might add defence in depth but could break PWA install flows or iOS standalone behavior.

### Decision

Put the origin behind the **Cloudflare proxy** for DNS, TLS, WAF, and rate limiting. **Cloudflare Access** is not committed until spike #14 answers PWA/cookie/bypass questions.

### Alternatives rejected

- **No edge proxy** — Loses cheap WAF/rate limits and consistent TLS at the edge; Fly/homelab still need TLS somewhere.

### Consequences

- DNS and Cloudflare dashboard settings are host config in `deploy/`, not application code.
- If Access is adopted after the spike, it sits in front of passkey auth (defence in depth), not as the only lock.
- Tunnel + Access for homelab reuses the same Cloudflare account patterns from Phase 2 hosting.

### Homelab migration risk

Low for DNS/TLS/WAF — point tunnel ingress at the same container. Access policy details may differ per phase but stay outside `packages/core`.

## ADR-008 — Portfolio analytics

### Status

Proposed, awaiting Jackson.

### Context

We want lightweight insight into site usage without self-hosting another service or paid SaaS, and without cookie banners that complicate a personal PWA.

### Decision

Use **Cloudflare Web Analytics** (free, cookieless) for the public-facing site, already compatible with Cloudflare proxying, with metrics queried via the **GraphQL Analytics API** where needed for dashboards.

### Alternatives rejected

- **Umami** — Self-hosted; richer events but another service to run and back up.
- **Plausible** — Paid hosted analytics; unnecessary cost for a single-operator dashboard.

### Consequences

- Analytics integration lives in server/deploy layers or optional jobs, not in `packages/core`.
- Portfolio views may aggregate Cloudflare metrics rather than embedding third-party scripts in the SPA.
- Switching providers later is config-heavy but does not require core rewrites.

### Homelab migration risk

Low — analytics is orthogonal to the app container; changing provider affects dashboards and env tokens only.

## ADR-009 — Scheduler

### Context

Background jobs (sync, cleanup, reminders) should run on a predictable cadence without depending on Fly-specific cron or external CI schedules that can drift or miss when the app is down.

### Decision

Run an **in-process scheduler** inside the **server container** (no external cron service).

### Alternatives rejected

- **Fly Machines cron** — Ties scheduling to Fly’s platform; homelab would need a different trigger.
- **GitHub Actions cron** — Requires repo/network availability and is decoupled from app health and SQLite state.

### Consequences

- Job registration and locking live in `apps/server` alongside the HTTP server.
- Only one scheduler instance should run per deployment (single container assumption matches ADR-005).
- Long jobs must respect SQLite single-writer constraints and avoid blocking the event loop.

### Homelab migration risk

None — the same Node process runs scheduled work in Compose; no Fly cron to replace.

## ADR-010 — Lock-in rules

### Context

Foundation packages should remain portable so hosting, auth vendors, and analytics can change without rewriting domain logic.

### Decision

- **No vendor SDKs** in `packages/core`.
- **All host-specific configuration** (Fly, Cloudflare, tunnel, volumes, analytics tokens) lives in **environment variables** and **`deploy/`**.

### Alternatives rejected

- **Embedding provider clients in core** — Would violate purity and make homelab migration a rewrite instead of a config swap.

### Consequences

- `packages/core` stays testable and free of I/O; integrations sit in `apps/server`, `packages/db`, and deploy manifests.
- New vendors are adopted by adding adapters at the edges, not by changing shared types.
- Code review and `purity.test.ts` guardrails reinforce the boundary.

### Homelab migration risk

None — the rules exist specifically to keep migration to homelab a deploy/config exercise.

## ADR-008 — Production Postgres (Supabase) and Vercel

### Context

Fly.io + SQLite never reached a stable production state (empty volume, boot issues). Jackson already uses Supabase for Jim; a **dedicated** `jackson-os` Supabase project isolates schema in `public` without touching Jim tables. Vercel is already connected for frontend work.

### Decision

- **Database:** Drizzle ORM on **Postgres** (`postgres` driver + Supabase pooler in production). Migrations in `packages/db/drizzle/` target the dedicated Supabase project (`nsonjougvktiqlzvvyqw`).
- **Hosting:** **Vercel** serves `apps/web/dist` and runs the Hono API via `api/index.ts`. Dataset refresh on Vercel uses **Cron** (`/api/cron/tick`) instead of an in-process scheduler.
- **Fly + SQLite:** Deprecated; `deploy/fly.toml` retained for rollback only.

### Consequences

- `DATABASE_URL` is required everywhere the server runs (except tests using `pglite:` or PGlite via `openTestDb`).
- Local dev and CI unit tests use **PGlite**; production uses Supabase.
- Compose homelab runs the same image with `DATABASE_URL` instead of a SQLite volume.
