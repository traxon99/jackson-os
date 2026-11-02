#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${JOS_IMAGE:-jos-persistence-test}"
CONTAINER="${JOS_CONTAINER:-jos-persistence-test}"
VOLUME="${JOS_VOLUME:-jos-persistence-test-data}"
MARKER_ID="docker-persistence-test"
APP_ORIGIN="${APP_ORIGIN:-http://localhost:8080}"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Building image ${IMAGE}"
docker build -t "$IMAGE" "$ROOT"

echo "==> Starting container with volume ${VOLUME}"
docker volume rm -f "$VOLUME" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" \
  -e APP_ORIGIN="$APP_ORIGIN" \
  -v "${VOLUME}:/data" \
  "$IMAGE" >/dev/null

echo "==> Waiting for health check"
deadline=$((SECONDS + 120))
while true; do
  status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$CONTAINER" 2>/dev/null || echo missing)"
  if [ "$status" = "healthy" ]; then
    echo "    healthy"
    break
  fi
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "Health check did not pass within 120s (status=${status})" >&2
    docker logs "$CONTAINER" >&2 || true
    exit 1
  fi
  sleep 1
done

echo "==> Inserting marker row"
docker exec "$CONTAINER" node -e "
const Database = require('better-sqlite3');
const db = new Database('/data/app.db');
const now = Date.now();
db.prepare(
  \"INSERT INTO widget_layout (id, layout, updated_at) VALUES (?, ?, ?)\"
).run('${MARKER_ID}', JSON.stringify({ marker: '${MARKER_ID}' }), now);
db.close();
"

echo "==> Stopping container (must finish within 10s)"
start_stop=$SECONDS
docker stop "$CONTAINER" >/dev/null
stop_elapsed=$((SECONDS - start_stop))
echo "    stop took ${stop_elapsed}s"
if [ "$stop_elapsed" -ge 10 ]; then
  echo "docker stop took ${stop_elapsed}s (limit 10s)" >&2
  exit 1
fi

echo "==> Starting container again"
docker run -d --name "$CONTAINER" \
  -e APP_ORIGIN="$APP_ORIGIN" \
  -v "${VOLUME}:/data" \
  "$IMAGE" >/dev/null

deadline=$((SECONDS + 120))
while true; do
  status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$CONTAINER" 2>/dev/null || echo missing)"
  if [ "$status" = "healthy" ]; then
    break
  fi
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "Health check did not pass after restart" >&2
    exit 1
  fi
  sleep 1
done

echo "==> Reading marker row back"
read_back="$(docker exec "$CONTAINER" node -e "
const Database = require('better-sqlite3');
const db = new Database('/data/app.db');
const row = db.prepare('SELECT layout FROM widget_layout WHERE id = ?').get('${MARKER_ID}');
db.close();
if (!row) process.exit(2);
process.stdout.write(row.layout);
")"

if [ "$read_back" != "{\"marker\":\"${MARKER_ID}\"}" ]; then
  echo "Unexpected layout after restart: ${read_back}" >&2
  exit 1
fi

echo "==> Persistence test passed"
