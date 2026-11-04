# Hosting

jackson-os runs in three modes (see [README](../README.md)): local dev, Docker Compose (homelab), and **Vercel + Supabase Postgres** (production). Fly.io + SQLite was the previous Phase 1; those files remain under `deploy/` for rollback reference but are **deprecated** for new deploys.

## Phase 1 — Vercel + Supabase (production)

### Supabase project

Use the dedicated **`jackson-os`** project (Traxa 99 / traxon99 org), **public schema only**:

| Field        | Value                                      |
| ------------ | ------------------------------------------ |
| Project name | `jackson-os`                               |
| Project ref  | `nsonjougvktiqlzvvyqw`                     |
| API URL      | `https://nsonjougvktiqlzvvyqw.supabase.co` |
| Region       | `us-east-1`                                |

No tables from the Jim app live in this project. All jackson-os Drizzle migrations target `public` on this empty project.

#### One-time database setup

After the project is `ACTIVE_HEALTHY`, apply migrations (from a machine with `DATABASE_URL` set to the Supabase **direct** or **session** connection string):

```bash
export DATABASE_URL='postgresql://postgres.[ref]:[password]@aws-0-us-east-1.pooler.supabase.com:5432/postgres'
pnpm --filter @jos/db build
node --input-type=module -e "
  import { openDb, runMigrations, closeDb } from '@jos/db';
  const conn = await openDb(process.env.DATABASE_URL);
  await runMigrations(conn);
  await closeDb(conn);
  console.log('Migrations applied.');
"
```

Alternatively, run the SQL in [`packages/db/drizzle/0000_initial.sql`](../packages/db/drizzle/0000_initial.sql) in the Supabase SQL editor.

### Vercel project

1. Create or link a Vercel project for this GitHub repo (monorepo root; `vercel.json` at repo root).
2. Set **Production** environment variables (Settings → Environment Variables):

| Variable                                  | Required     | Notes                                                                                                                   |
| ----------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                            | Yes          | Supabase **transaction pooler** URI for serverless (`prepare: false` in code). Session/direct URL for local `pnpm dev`. |
| `APP_ORIGIN`                              | Yes          | Public HTTPS origin, e.g. `https://os.jacksonyanek.com`                                                                 |
| `RP_ID`                                   | Yes          | WebAuthn RP ID (hostname only), e.g. `os.jacksonyanek.com`                                                              |
| `SETUP_TOKEN`                             | First deploy | ≥32 chars; one-time setup                                                                                               |
| `CRON_SECRET`                             | Yes (prod)   | ≥16 chars; Vercel Cron sends `Authorization: Bearer …` to `/api/cron/tick`                                              |
| `TRUST_CLOUDFLARE`                        | Recommended  | `true` when behind Cloudflare proxy                                                                                     |
| `JIM_PAT`, `GITHUB_TOKEN`, `CLOUDFLARE_*` | Optional     | Same as local                                                                                                           |

3. GitHub Actions deploy (optional): add secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` for [.github/workflows/deploy.yml](../.github/workflows/deploy.yml). Vercel Git integration alone also deploys on push to `main`.

### Architecture on Vercel

- **Static web:** `apps/web/dist` (`outputDirectory` in `vercel.json`).
- **API:** Hono via [`api/index.ts`](../api/index.ts) (`/api/*` rewrite).
- **Background refresh:** In-process scheduler is **disabled** on Vercel (`VERCEL=1`). Vercel Cron hits `/api/cron/tick` every 5 minutes (see `vercel.json`).

### Cloudflare DNS and TLS

Same as before: proxied CNAME to Vercel, SSL **Full (strict)**, WAF rate limits on `/api/auth/*`.

### Deprecated — Fly.io + SQLite

[`deploy/fly.toml`](../deploy/fly.toml) and the Fly volume workflow are kept for rollback only. The Fly app had no production SQLite data to migrate.

## Phase 2 — Homelab migration (Compose + tunnel)

Goal: run the same container image with **Postgres** (`DATABASE_URL`) instead of a local SQLite file.

1. Copy secrets and set `DATABASE_URL` (can point at Supabase or a local Postgres).
2. `docker compose -f deploy/compose.yaml up -d --build`
3. Ingress via Cloudflare Tunnel (`--profile tunnel`) as before.

Backups: use Supabase backups / `pg_dump` — the old SQLite `VACUUM INTO` helper was removed.

## Deploy automation

Pushes to `main` run CI, then [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) deploys to Vercel when secrets are configured.

## Related docs

- [docs/SECURITY.md](SECURITY.md) — auth recovery and `admin reset-auth`
- [docs/PWA.md](PWA.md) — installable web app behavior
