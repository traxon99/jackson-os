# Security

How jackson-os enforces baseline HTTP and logging controls in `apps/server`, plus SQLite backup and restore.

## Controls

| Control                                                                                         | File                                                                                        | Test                                                                                                  |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Security headers (CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) | [`apps/server/src/middleware/headers.ts`](../apps/server/src/middleware/headers.ts)         | [`apps/server/src/middleware/headers.test.ts`](../apps/server/src/middleware/headers.test.ts)         |
| CSRF: same-origin check on state-changing requests                                              | [`apps/server/src/middleware/origin.ts`](../apps/server/src/middleware/origin.ts)           | [`apps/server/src/middleware/origin.test.ts`](../apps/server/src/middleware/origin.test.ts)           |
| Token-bucket rate limiter (pure logic)                                                          | [`apps/server/src/lib/rate-limit.ts`](../apps/server/src/lib/rate-limit.ts)                 | [`apps/server/src/lib/rate-limit.test.ts`](../apps/server/src/lib/rate-limit.test.ts)                 |
| Per-IP rate limits on `/api/auth/*` and other `/api/*` routes                                   | [`apps/server/src/middleware/rate-limit.ts`](../apps/server/src/middleware/rate-limit.ts)   | [`apps/server/src/middleware/rate-limit.test.ts`](../apps/server/src/middleware/rate-limit.test.ts)   |
| Default-deny API session gate                                                                   | [`apps/server/src/middleware/auth-gate.ts`](../apps/server/src/middleware/auth-gate.ts)     | [`apps/server/src/middleware/auth-gate.test.ts`](../apps/server/src/middleware/auth-gate.test.ts)     |
| Structured request logs (no headers, cookies, or body)                                          | [`apps/server/src/middleware/request-log.ts`](../apps/server/src/middleware/request-log.ts) | [`apps/server/src/middleware/request-log.test.ts`](../apps/server/src/middleware/request-log.test.ts) |
| Secret redaction in application logs                                                            | [`apps/server/src/log.ts`](../apps/server/src/log.ts)                                       | [`apps/server/src/log.test.ts`](../apps/server/src/log.test.ts)                                       |

## Backups & restore

Scheduled backups use [`packages/db/src/backup.ts`](../packages/db/src/backup.ts): `backupNow` writes a consistent SQLite snapshot with `VACUUM INTO`, and `pruneBackups` removes `app-*.db` files older than the retention window (default 14 days).

To restore from a backup file:

1. Stop the server.
2. Copy the backup file over `app.db` in the data directory.
3. Delete `app.db-wal` and `app.db-shm` if present.
4. Start the server again.

## Lost my phone

If you lose the device that held your passkey, use one of these paths. Both end with a working passkey on a new device.

### 1. Recovery code (no shell access)

Use this when you saved a recovery code at setup.

1. Open **`{APP_ORIGIN}/recover`** in a browser (same origin you normally use to sign in).
2. Enter a single-use recovery code. The server creates a short-lived **recovery** session.
3. Register a new passkey (same flow as first-time setup). That passkey becomes your daily sign-in method.

**Compose (local / homelab)** — `APP_ORIGIN` is usually `http://localhost:8080`:

```text
http://localhost:8080/recover
```

**Fly (production)** — `APP_ORIGIN` is `https://os.jacksonyanek.com`:

```text
https://os.jacksonyanek.com/recover
```

### 2. Admin reset (shell access)

Use this when you have shell access to the host running jackson-os and no recovery code works.

1. **Stop** the app (or run the command on a stopped container volume — do not run two servers on the same `DATA_DIR`).
2. Run **`admin reset-auth`**. It wipes WebAuthn credentials, sessions, and recovery codes, clears the “setup token already used” mark, and prints a new **`SETUP_TOKEN` once**.
3. Set that token as **`SETUP_TOKEN`** (or write it to the secret file your deployment uses), **restart** the server.
4. Open **`{APP_ORIGIN}/setup`**, present the setup token, and register a new passkey.

#### Compose

From the repo root, with the stack running:

```bash
docker compose -f deploy/compose.yaml exec app node dist/admin.js reset-auth --yes
```

Copy the printed token, update `deploy/secrets/setup_token`, then restart:

```bash
printf '%s' '<paste-token-here>' > deploy/secrets/setup_token
docker compose -f deploy/compose.yaml restart app
```

Open:

```text
http://localhost:8080/setup
```

For a dev tree without Docker, point `DATA_DIR` at your data directory:

```bash
export DATA_DIR=./data APP_ORIGIN=http://localhost:8080
pnpm --filter server admin reset-auth --yes
```

Set `SETUP_TOKEN` in the environment (or `.env`), restart `pnpm dev` / the server process, then open `http://localhost:8080/setup`.

#### Fly

SSH into the machine and run the same CLI against `/data`:

```bash
fly ssh console -a <your-app-name>
node /out/dist/admin.js reset-auth --yes
```

Set the new token and redeploy or restart:

```bash
fly secrets set SETUP_TOKEN=<paste-token-here> -a <your-app-name>
```

Open:

```text
https://os.jacksonyanek.com/setup
```

Replace `<your-app-name>` with the Fly app name from `deploy/fly.toml`.
