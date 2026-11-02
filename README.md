# jackson-os

Personal operating system monorepo (Vite + React web, Hono API, SQLite). See [AGENTS.md](AGENTS.md) for layout and day-to-day commands.

**Requirements:** Node 22, pnpm 9 (`corepack enable` if needed). Docker is only required for [Compose](#compose-homelab) mode.

## Dev (local)

From a clean clone:

```bash
pnpm install
cp .env.example .env
```

Edit `.env`:

- Set `APP_ORIGIN=http://localhost:5173` (Vite dev server; API stays on port 8080).
- Set `DATA_DIR` to a writable directory (for example `./data`) and create it: `mkdir -p data`.
- Remove any optional lines that are still empty (for example `SETUP_TOKEN=`). Blank optional values fail validation.

Load env and start web + API:

```bash
export $(grep -E '^[A-Z]' .env | grep -v '=$' | xargs)
pnpm dev
```

Open `APP_ORIGIN` in a browser. The Vite dev server proxies `/api` to the server on `PORT` (default `8080`).

## Compose (homelab)

Build and run the production image locally with a persistent volume:

```bash
# One-time: setup token file (≥32 characters)
mkdir -p deploy/secrets
printf '%s' 'change-me-to-a-long-random-setup-token' > deploy/secrets/setup_token

docker compose -f deploy/compose.yaml up --build
```

The app listens on [http://localhost:8080](http://localhost:8080). Data lives in the Docker volume `jos-data` (`DATA_DIR=/data` inside the container).

Optional Cloudflare tunnel (requires `deploy/secrets/tunnel_token`):

```bash
docker compose -f deploy/compose.yaml --profile tunnel up
```

## Fly (production)

Fly.io deployment (volume, secrets, `fly.toml`) is documented in [docs/HOSTING.md](docs/HOSTING.md).

## Environment variables by run mode

Values below are typical; optional integration tokens behave the same in every mode when set.

| Variable                                  | Dev                                       | Compose                                           | Fly                                                       |
| ----------------------------------------- | ----------------------------------------- | ------------------------------------------------- | --------------------------------------------------------- |
| `NODE_ENV`                                | `development`                             | `production` (image default)                      | `production`                                              |
| `PORT`                                    | `8080` (API)                              | `8080`                                            | `8080`                                                    |
| `APP_ORIGIN`                              | `http://localhost:5173`                   | `http://localhost:8080`                           | Public HTTPS URL (see [docs/HOSTING.md](docs/HOSTING.md)) |
| `WEB_DIST`                                | `../web/dist` (server package relative)   | `/out/web/dist` (image)                           | Same as Compose image                                     |
| `DATA_DIR`                                | Local path (e.g. `./data`)                | `/data` (named volume)                            | Fly volume mount at `/data`                               |
| `RP_ID`                                   | Hostname from `.env` (default in example) | Default (`os.jacksonyanek.com`) unless overridden | Production WebAuthn RP ID                                 |
| `SETUP_TOKEN`                             | Optional env var                          | Via `SETUP_TOKEN_FILE=/run/secrets/setup_token`   | Platform secrets (see hosting doc)                        |
| `JIM_PAT`, `GITHUB_TOKEN`, `CLOUDFLARE_*` | Optional env vars                         | Optional env vars on `app` service                | Optional Fly secrets                                      |

Copy [.env.example](.env.example) for local development; Compose and Fly set production values in `deploy/` or the host platform instead.

## CI on `main`

This repo runs [GitHub Actions CI](.github/workflows/ci.yml) on pushes and pull requests. **Branch protection must require that CI check on `main`** — enable “Require status checks to pass” and select the CI job in the repository’s GitHub **Settings → Branches** (or rulesets). That step cannot be done from the repo alone.

## Checks

From the repo root: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
