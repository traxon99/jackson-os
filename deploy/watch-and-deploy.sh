#!/usr/bin/env bash
# Run on the machine that hosts docker compose (homelab). Polls GitHub for main
# updates and rebuilds the stack when origin/main moves.
#
# Usage (from repo root):
#   ./deploy/watch-and-deploy.sh
#
# Env:
#   REMOTE=origin   BRANCH=main   INTERVAL_SEC=60
#   COMPOSE_FILE=deploy/compose.yaml
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-main}"
INTERVAL_SEC="${INTERVAL_SEC:-60}"
COMPOSE_FILE="${COMPOSE_FILE:-deploy/compose.yaml}"

if ! git remote get-url "$REMOTE" >/dev/null 2>&1; then
  echo "Remote $REMOTE not configured." >&2
  exit 1
fi

echo "Watching $REMOTE/$BRANCH every ${INTERVAL_SEC}s; compose file $COMPOSE_FILE"

while true; do
  git fetch "$REMOTE" "$BRANCH" --quiet || true
  if git show-ref --verify --quiet "refs/remotes/$REMOTE/$BRANCH"; then
    local_sha="$(git rev-parse HEAD)"
    remote_sha="$(git rev-parse "$REMOTE/$BRANCH")"
    if [[ "$local_sha" != "$remote_sha" ]]; then
      echo "→ $REMOTE/$BRANCH moved to ${remote_sha:0:7}; pulling and rebuilding"
      if git checkout "$BRANCH" && git merge --ff-only "$REMOTE/$BRANCH"; then
        docker compose -f "$COMPOSE_FILE" up -d --build
        echo "→ deploy complete at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
      else
        echo "→ deploy failed; will retry" >&2
      fi
    fi
  fi
  sleep "$INTERVAL_SEC"
done
