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
