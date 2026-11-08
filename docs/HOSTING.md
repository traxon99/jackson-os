# Hosting

jackson-os runs on this machine. Local development uses `pnpm dev`. Production is the Docker Compose stack in [`deploy/compose.yaml`](../deploy/compose.yaml), with **Supabase Postgres** as the database. GitHub Actions checks the code and does not deploy.

Fly.io + SQLite never became a stable production host; those files stay under `deploy/` for rollback only. A Vercel deploy (serverless API plus Cron) was removed so the SPA, API, and in-process scheduler stay one long-running Node process on this machine.

## Database — Supabase

Use the dedicated **`jackson-os`** project (Traxa 99 / traxon99 org), **public schema only**:

| Field        | Value                                      |
| ------------ | ------------------------------------------ |
| Project name | `jackson-os`                               |
| Project ref  | `nsonjougvktiqlzvvyqw`                     |
| API URL      | `https://nsonjougvktiqlzvvyqw.supabase.co` |
| Region       | `us-east-1`                                |

No tables from the Jim app live in this project. All jackson-os Drizzle migrations target `public` on this empty project.

### One-time database setup

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

Alternatively, run the SQL in [`packages/db/drizzle/`](../packages/db/drizzle/) in the Supabase SQL editor (including [`0001_supabase_api_lockdown.sql`](../packages/db/drizzle/0001_supabase_api_lockdown.sql), which enables RLS and revokes Data API roles).

The long-running server can use the session, direct, or transaction pooler URI. The driver already sets `prepare: false`.

## Production — this machine

1. Copy secrets and set `DATABASE_URL` (Supabase, or another Postgres you run yourself).
2. `docker compose -f deploy/compose.yaml up -d --build`
3. Optional public ingress: Cloudflare Tunnel (`--profile tunnel`), merging [`deploy/compose.tunnel.yaml`](../deploy/compose.tunnel.yaml) so `TRUST_CLOUDFLARE=true` (per-IP rate limits behind the proxy).

The app listens on port 8080. `APP_ORIGIN` must be the URL browsers use (`http://localhost:8080` on the machine, or the public HTTPS origin).

### Environment variables

| Variable                                  | Required         | Notes                                                                                         |
| ----------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                            | Yes              | Supabase session, direct, or pooler URI                                                       |
| `APP_ORIGIN`                              | Yes              | Origin browsers use, e.g. `https://os.jacksonyanek.com` or `http://localhost:8080`            |
| `RP_ID`                                   | Yes              | WebAuthn RP ID (hostname only), e.g. `os.jacksonyanek.com`                                    |
| `SETUP_TOKEN`                             | First start      | ≥32 chars; one-time setup. Compose reads `SETUP_TOKEN_FILE=/run/secrets/setup_token`          |
| `CRON_SECRET`                             | No               | Optional bearer for `POST /api/cron/tick`. Dataset refresh uses the in-process scheduler      |
| `AGENT_API_TOKEN`                         | No               | Optional bearer for `/api/agent` (Grok Bot). See [AGENT-INTEGRATION.md](AGENT-INTEGRATION.md) |
| `TRUST_CLOUDFLARE`                        | Behind the proxy | `true` when Cloudflare terminates TLS (set automatically via `compose.tunnel.yaml`)           |
| `JIM_PAT`, `GITHUB_TOKEN`, `CLOUDFLARE_*` | Optional         | Same as local                                                                                 |

`DISABLE_SCHEDULER=true` turns the in-process scheduler off.

### Architecture

- One container runs the Hono server, serves the built SPA (`WEB_DIST`, `/out/web/dist` in the image), and starts the in-process scheduler.
- No platform cron and no GitHub Actions deploy. Build and start the image on this machine.
- Public hostname: Cloudflare Tunnel, SSL **Full (strict)**, WAF rate limits on `/api/auth/*`.

Backups: Supabase backups and/or `pg_dump` from a trusted host with `DATABASE_URL`.

## CI

Pushes and pull requests run [.github/workflows/ci.yml](../.github/workflows/ci.yml): lint, typecheck, test, build, and the web-bundle secret scan. That workflow does not build a deploy image and does not publish anywhere.

## Deprecated — Fly.io + SQLite

[`deploy/fly.toml`](../deploy/fly.toml) and the Fly volume workflow are kept for rollback only. The Fly app had no production SQLite data to migrate.

## Auto-deploy on this host

GitHub Actions does not deploy. On the machine that runs Compose, keep a clone checked out on `main` and start the watcher. It polls `origin/main` and runs `docker compose up -d --build` when that branch moves. The sample systemd unit sets `COMPOSE_OVERRIDE=deploy/compose.tunnel.yaml` for the tunnel host.

```bash
./deploy/watch-and-deploy.sh
```

For a persistent service, set the user and repo path in [deploy/jackson-os-autodeploy.service](../deploy/jackson-os-autodeploy.service), then install it. Push from any device; this host pulls and rebuilds.

## Related docs

- [docs/SECURITY.md](SECURITY.md) — auth recovery and `admin reset-auth`
- [docs/PWA.md](PWA.md) — installable web app behavior
