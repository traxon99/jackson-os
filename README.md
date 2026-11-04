# jackson-os

Personal operating system monorepo (Vite + React web, Hono API, Supabase Postgres). See [AGENTS.md](AGENTS.md) for layout and day-to-day commands.

**Requirements:** Node 22, pnpm 9 (`corepack enable` if needed). Docker is optional ([Compose](#compose-homelab) mode).

## Dev (local)

From a clean clone:

```bash
pnpm install
cp .env.example .env
```

Edit `.env`:

- Set `APP_ORIGIN=http://localhost:5173` (Vite dev server; API stays on port 8080).
- Set `DATABASE_URL` to your Supabase **session** or direct Postgres URI (dedicated `jackson-os` project — see [docs/HOSTING.md](docs/HOSTING.md)).
- Remove any optional lines that are still empty (for example `SETUP_TOKEN=`). Blank optional values fail validation.

Load env and start web + API:

```bash
export $(grep -E '^[A-Z]' .env | grep -v '=$' | xargs)
pnpm dev
```

Open `APP_ORIGIN` in a browser. The Vite dev server proxies `/api` to the server on `PORT` (default `8080`). Migrations run on server startup.

## Compose (homelab)

Build and run the production image with Postgres via `DATABASE_URL`:

```bash
# One-time: setup token file (≥32 characters)
mkdir -p deploy/secrets
printf '%s' 'change-me-to-a-long-random-setup-token' > deploy/secrets/setup_token

export DATABASE_URL='postgresql://...'
docker compose -f deploy/compose.yaml up --build
```

The app listens on [http://localhost:8080](http://localhost:8080).

Optional Cloudflare tunnel (requires `deploy/secrets/tunnel_token`):

```bash
docker compose -f deploy/compose.yaml --profile tunnel up
```

## Production (this machine)

The Compose stack above is production. Supabase holds the database. Env vars, the one-time migration, and the tunnel are in [docs/HOSTING.md](docs/HOSTING.md). Nothing in GitHub Actions deploys the app.

On the host, `./deploy/watch-and-deploy.sh` rebuilds Compose whenever `main` moves on GitHub.

## Environment variables by run mode

| Variable                                                 | Dev                                       | Host (Compose)                                           |
| -------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------- |
| `NODE_ENV`                                               | `development`                             | `production` (image default)                             |
| `PORT`                                                   | `8080` (API)                              | `8080`                                                   |
| `APP_ORIGIN`                                             | `http://localhost:5173`                   | `http://localhost:8080`, or the public HTTPS origin      |
| `DATABASE_URL`                                           | Supabase session/direct URI               | Same (session, direct, or pooler)                        |
| `WEB_DIST`                                               | `../web/dist` (server package relative)   | `/out/web/dist` (image)                                  |
| `RP_ID`                                                  | Hostname from `.env` (default in example) | Hostname of `APP_ORIGIN` (default `os.jacksonyanek.com`) |
| `SETUP_TOKEN`                                            | Optional env var                          | Via `SETUP_TOKEN_FILE=/run/secrets/setup_token`          |
| `CRON_SECRET`                                            | Optional                                  | Optional; the in-process scheduler refreshes datasets    |
| `JIM_PAT`, `JIM_API_URL`, `GITHUB_TOKEN`, `CLOUDFLARE_*` | Optional env vars                         | Optional env vars on the `app` service                   |

Copy [.env.example](.env.example) for local development.

## CI on `main`

Pushes and pull requests run [GitHub Actions CI](.github/workflows/ci.yml): lint, typecheck, test, build, and the web-bundle secret scan. That workflow does not build a deploy image and does not publish anywhere. **Branch protection must require the `ci` job on `main`** — enable “Require status checks to pass” and select that job in the repository’s GitHub **Settings → Branches** (or rulesets). That step cannot be done from the repo alone.

## Checks

From the repo root: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
