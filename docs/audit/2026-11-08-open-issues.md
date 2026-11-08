# Open-issue audit — 2026-11-08

Repo: `jackson-os` at branch `cursor/security-rls-trust-cloudflare-c420` (base `main` @ 7bab7e1).  
Scope: implementation evidence in code/CI only (no live host, iOS PWA, or Supabase console checks).

## Open issues (5)

| Issue    | Title                              | Evidence vs acceptance                                                                                                                                                                                                                     | Suggested disposition                                                                      |
| -------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| **#1**   | Record foundation ADRs             | `docs/DECISIONS.md` exists with ADR-001–010; `AGENTS.md` links to decisions docs. Several ADRs are stale vs current stack (e.g. ADR-004 SQLite, ADR-005 Fly phase 1). ⚑ Jackson items in original issue not recorded as deferred.          | **Partial** — docs exist; refresh outdated ADRs + Jackson sign-offs before close.          |
| **#14**  | Spike: Cloudflare Access + iOS PWA | No spike write-up in repo; requires manual iOS/PWA + Access policy experiments.                                                                                                                                                            | **Open / Jackson + manual** — not implementable from code alone.                           |
| **#15**  | M0 Foundation tracking             | Sub-issues #2–#13 checked; #1 and #14 open. Codebase has passkeys, PWA assets, Compose host path (#173 merged), Supabase (#170). Exit criterion (iPhone install + homelab parity) not verified in this audit.                              | **Partial** — close when #1, #14 resolved and exit criteria manually confirmed.            |
| **#136** | M1 Jim widgets tracking            | Jim adapter/widgets merged (#166–#168, #172). `JIM_PAT` live read-only token + iPhone widget check are Jackson-only; Jim #736 upstream.                                                                                                    | **Partial** — code largely shipped; epic stays open until live PAT + visual check.         |
| **#175** | Security hardening (Nov 2026)      | Vercel stories obsolete (#176). Deploy path unified on host watcher (#173). **This PR** adds repo RLS migration + tunnel `TRUST_CLOUDFLARE`. Jackson-only: branch ruleset, disable Supabase Data API, `JIM_PAT` upstream, passkey hygiene. | **Partial after merge** — repo-side cursor gaps addressed; Jackson-only checklist remains. |

## Recent merged PRs (relevant)

| PR   | Summary                                                   |
| ---- | --------------------------------------------------------- |
| #177 | Agent API (`AGENT_API_TOKEN`); disabled when unset        |
| #176 | Removed Vercel; homelab production                        |
| #173 | Host watcher + systemd unit for Compose rebuild on `main` |
| #170 | Supabase Postgres migration                               |

## Cancelled / out of scope

- Fly → Vercel replatform: **cancelled**; production is Compose on host + Supabase.
- #175 Vercel cron/CSP/clientIp stories: **obsolete** after #176.

## Code fixes in this pass (PR)

1. `packages/db/drizzle/0001_supabase_api_lockdown.sql` — RLS + privilege revoke for all 9 `public` tables.
2. `deploy/compose.tunnel.yaml` + `COMPOSE_OVERRIDE` in watcher/systemd — `TRUST_CLOUDFLARE=true` behind tunnel.
