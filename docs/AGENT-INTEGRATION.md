# Agent integration (Grok Bot)

jackson-os exposes a small **machine-token HTTP API** under `/api/agent` so an external assistant (for example Grok Bot on the desktop) can read dashboard state and trigger safe operations without WebAuthn passkeys or session cookies.

Human login UX is unchanged. The agent surface is optional and disabled until you configure a token.

## Enable

Set a long random secret (minimum 32 characters):

```bash
# .env or Compose env
AGENT_API_TOKEN='your-long-random-token-here'
```

For Compose / Docker secrets (same pattern as `SETUP_TOKEN`):

```bash
printf '%s' "$(openssl rand -hex 32)" > deploy/secrets/agent_api_token
```

```yaml
# deploy/compose.yaml (example)
environment:
  AGENT_API_TOKEN_FILE: /run/secrets/agent_api_token
secrets:
  - agent_api_token
```

When `AGENT_API_TOKEN` is unset, `/api/agent/*` routes return **404** (the API is not advertised).

### Rotation

1. Generate a new token and update `AGENT_API_TOKEN` (or the secret file).
2. Restart the jackson-os server.
3. Update Grok Bot (or any client) with the new bearer value.
4. Revoke the old token by removing it from config — there is no server-side token list.

The token is redacted in server logs (`AGENT_API_TOKEN` is in the secret key list).

## Authentication

Send on every request:

```http
Authorization: Bearer <AGENT_API_TOKEN>
```

This is **not** a passkey session cookie and does not grant access to human-only routes (`/api/sources`, `/api/layout`, admin reset, and so on).

## Endpoints

| Method | Path                | Description                                                |
| ------ | ------------------- | ---------------------------------------------------------- |
| `GET`  | `/api/agent/tools`  | List tool names, descriptions, and JSON input schemas      |
| `POST` | `/api/agent/invoke` | Run one tool: `{ "tool": "<name>", "arguments": { ... } }` |

Base URL is your public `APP_ORIGIN`, for example `https://os.jacksonyanek.com` behind Cloudflare Tunnel, or `http://localhost:8080` in Compose.

### Example: list tools

```bash
curl -sS \
  -H "Authorization: Bearer $AGENT_API_TOKEN" \
  "https://os.jacksonyanek.com/api/agent/tools"
```

### Example: invoke

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $AGENT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tool":"list_sources","arguments":{}}' \
  "https://os.jacksonyanek.com/api/agent/invoke"
```

Success shape:

```json
{ "ok": true, "tool": "list_sources", "result": [ ... ] }
```

Error shape:

```json
{ "ok": false, "error": "Bad Request", "issues": [ ... ] }
```

## Tools (initial set)

| Tool                 | Purpose                                                |
| -------------------- | ------------------------------------------------------ |
| `status`             | API health summary and counts                          |
| `list_sources`       | Source enablement and last/next fetch times            |
| `snapshot_summaries` | Per-dataset cache status (optional `sourceId`)         |
| `list_widgets`       | Widget metadata from the registry                      |
| `get_layout`         | Dashboard layout (read-only)                           |
| `refresh_source`     | Trigger `{ "sourceId": "..." }` refresh (rate limited) |
| `list_action_log`    | Recent action log rows (optional `limit`, `widgetId`)  |

Mutating or sensitive human actions (layout edits, passkey registration, auth reset) are **not** exposed on this surface.

## Safety

- **Rate limits**: Agent routes share a dedicated token bucket (~60 burst, 1 req/s refill per client IP). `refresh_source` reuses the same refresh limiter as `POST /api/sources/:id/refresh`.
- **CORS / Origin**: Browser origin checks are skipped for `/api/agent` so non-browser clients can `POST` without `Origin`. Prefer calling from Grok Bot or server-side tooling, not a public web page with a embedded token.
- **Audit**: Each successful or failed invoke writes an `action_log` row with `widgetId` `@agent` and `action` `tool:<name>`. Filter with `list_action_log` and `widgetId: "@agent"`.

## Grok Bot wiring (recommended)

1. Store `AGENT_API_TOKEN` and `APP_ORIGIN` in Grok Bot’s secure config (not in chat logs).
2. On startup or when the user asks about jackson-os, `GET /api/agent/tools` to discover schemas.
3. Map each tool to a Grok Bot tool definition using the returned `inputSchema`.
4. On tool call, `POST /api/agent/invoke` with the same name and arguments.
5. Surface structured JSON from `result` to the user; handle `429` with `Retry-After`.

No plugin binary ships from this repo; the HTTP contract above is the integration boundary.

## OpenAPI-style tool catalog

The tools list is the source of truth. For a static snapshot, run:

```bash
curl -sS -H "Authorization: Bearer $AGENT_API_TOKEN" \
  "$APP_ORIGIN/api/agent/tools" | jq .
```

Each entry includes `name`, `description`, and `inputSchema` (JSON Schema subset).
