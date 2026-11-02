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
