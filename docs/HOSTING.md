# Hosting

jackson-os runs in three modes (see [README](../README.md)): local dev, Docker Compose (homelab), and Fly.io (production). This doc covers **Phase 1 (Fly + Cloudflare)** and **Phase 2 (homelab migration)**.

## Phase 1 — Fly.io + Cloudflare

### Prerequisites

- [flyctl](https://fly.io/docs/hands-on/install-flyctl/) logged in
- Cloudflare DNS for `os.jacksonyanek.com`
- GitHub `FLY_API_TOKEN` secret (for [.github/workflows/deploy.yml](../.github/workflows/deploy.yml))

### Initial Fly setup

From the repo root:

```bash
fly launch --no-deploy -c deploy/fly.toml
```

Create the persistent volume (1 GB example; size as needed):

```bash
fly volumes create jos_data --region ewr --size 1 -a jackson-os
```

Set secrets (generate a fresh setup token ≥ 32 characters):

```bash
fly secrets set SETUP_TOKEN='…your-token…' -a jackson-os
```

Deploy manually the first time, or merge to `main` after CI and the deploy workflow runs:

```bash
fly deploy -c deploy/fly.toml --remote-only
```

Configuration reference: [`deploy/fly.toml`](../deploy/fly.toml) (`DATA_DIR=/data`, `TRUST_CLOUDFLARE=true`, `APP_ORIGIN=https://os.jacksonyanek.com`, health check on `/api/health`).

### Cloudflare DNS and TLS

1. Add a **proxied** (orange cloud) **CNAME** for `os.jacksonyanek.com` → `<your-app>.fly.dev`.
2. SSL/TLS mode: **Full (strict)**.
3. **WAF → Rate limiting rule** targeting `/api/auth/*` (match URI path prefix `/api/auth/`). Tune threshold to your traffic; the app also rate-limits auth routes.
4. **Disable or redirect** the public `*.fly.dev` hostname in the Fly dashboard (or Cloudflare) so users only enter via `os.jacksonyanek.com`.

### Monthly cost estimate (Phase 1)

| Item                                                   | Estimate (USD / month) | Notes                          |
| ------------------------------------------------------ | ---------------------- | ------------------------------ |
| Fly `shared-cpu-1x` 512 MB, `min_machines_running = 1` | ~$5–7                  | Always-on for the scheduler    |
| Fly volume 1 GB                                        | ~$0.15                 | `jos_data` at `/data`          |
| Cloudflare proxy + WAF (free tier)                     | $0                     | Paid plans add features        |
| **Typical total**                                      | **~$5–8**              | Excludes optional integrations |

## Phase 2 — Homelab migration (Fly → Compose + tunnel)

Goal: same container image and `/data` layout, ingress via Cloudflare Tunnel instead of Fly.

### Prepare homelab

1. Copy `deploy/secrets/setup_token` (or equivalent) and optional `tunnel_token`.
2. On the homelab host, from the repo:

   ```bash
   docker compose -f deploy/compose.yaml --profile tunnel up -d --build
   ```

3. Confirm the tunnel serves the app on your internal URL before cutting over DNS.

### Migrate data (stop → `VACUUM INTO` → copy → start)

On the **source** (Fly or existing Compose host) with the app **stopped**:

```bash
# Example on Compose — adjust paths/containers for Fly SSH
docker compose -f deploy/compose.yaml stop app
sqlite3 /var/lib/docker/volumes/deploy_jos-data/_data/app.db ".backup '/tmp/app-migrate.db'"
# or, from a running DB with backup helper:
# node -e "require('@jos/db')..."  — prefer packages/db backup: VACUUM INTO via backupNow
```

Using the built-in backup helper (app stopped, `DATA_DIR` pointing at the volume):

```bash
export DATA_DIR=/path/to/jos-data
node -e "
import { backupNow } from '@jos/db';
import { openDb, closeDb } from '@jos/db';
import { join } from 'node:path';
const dir = process.env.DATA_DIR;
const conn = openDb(join(dir, 'app.db'));
const dest = join(dir, 'migrate-' + Date.now() + '.db');
backupNow(conn.db, dest);
closeDb(conn);
console.log('Wrote', dest);
"
```

Copy the snapshot to the homelab volume (rsync/scp), replace `app.db`, remove `app.db-wal` / `app.db-shm` if present, then:

```bash
docker compose -f deploy/compose.yaml start app
```

Verify sign-in still works (`RP_ID` / `APP_ORIGIN` unchanged — still `os.jacksonyanek.com`).

### Cutover DNS

1. In Cloudflare, change `os.jacksonyanek.com` from the Fly CNAME to the tunnel hostname (or disable Fly proxy target).
2. Wait for TTL; confirm `https://os.jacksonyanek.com/api/auth/me` responds when signed in.

### Rollback

Flip the DNS record back to Fly (or re-enable the Fly target), restart the Fly app if needed, and stop the homelab stack. No app code changes required.

### Local dry-run (Compose)

Simulate migration without DNS:

```bash
docker compose -f deploy/compose.yaml up -d --build
# stop app, VACUUM INTO backup, copy to a fresh volume, start, curl /api/auth/me with session cookie
docker compose -f deploy/compose.yaml stop app
# … copy backup over app.db in jos-data …
docker compose -f deploy/compose.yaml start app
```

Use the same WebAuthn `RP_ID` and `APP_ORIGIN` in both stacks so passkeys remain valid.

## Deploy automation

Pushes to `main` run CI, then [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) deploys with `flyctl deploy -c deploy/fly.toml --remote-only --strategy rolling`. Failed Fly health checks leave the previous machines serving traffic.

## Related docs

- [docs/SECURITY.md](SECURITY.md) — auth recovery and `admin reset-auth`
- [docs/PWA.md](PWA.md) — installable web app behavior
