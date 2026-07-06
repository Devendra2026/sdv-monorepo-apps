#!/usr/bin/env bash
# Convex export 404 diagnostic — run on the Dokploy host (Linux).
# Does not print secret env values. Does not trigger exports unless you opt in.
set -euo pipefail

echo "=== Phase 2: Containers ==="
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}"

echo
echo "=== Convex-related containers ==="
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}' | grep -iE 'convex|backend|dashboard' || true

CONVEX_BACKEND_CONTAINER="${CONVEX_BACKEND_CONTAINER:-}"
if [[ -z "$CONVEX_BACKEND_CONTAINER" ]]; then
  CONVEX_BACKEND_CONTAINER="$(docker ps --format '{{.Names}}\t{{.Image}}' | grep -i convex-backend | head -1 | awk '{print $1}')"
fi
if [[ -z "$CONVEX_BACKEND_CONTAINER" ]]; then
  CONVEX_BACKEND_CONTAINER="$(docker ps --format '{{.Names}}\t{{.Image}}' | grep -iE 'convex.*backend|backend.*convex' | head -1 | awk '{print $1}')"
fi

if [[ -z "$CONVEX_BACKEND_CONTAINER" ]]; then
  echo "ERROR: Set CONVEX_BACKEND_CONTAINER to your Convex backend container name."
  exit 1
fi

echo
echo "Using CONVEX_BACKEND_CONTAINER=$CONVEX_BACKEND_CONTAINER"

echo
echo "=== Backend image metadata ==="
docker inspect "$CONVEX_BACKEND_CONTAINER" \
  --format 'Image={{.Config.Image}}
ImageID={{.Image}}
Created={{.Created}}
ExposedPorts={{json .Config.ExposedPorts}}
PublishedPorts={{json .NetworkSettings.Ports}}'

IMAGE_REF="$(docker inspect "$CONVEX_BACKEND_CONTAINER" --format '{{.Config.Image}}')"
docker image inspect "$IMAGE_REF" \
  --format 'RepoTags={{json .RepoTags}}
RepoDigests={{json .RepoDigests}}
Id={{.Id}}
Created={{.Created}}'

echo
echo "=== Networks ==="
docker inspect "$CONVEX_BACKEND_CONTAINER" \
  --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}'

echo
echo "=== Traefik / Dokploy labels (backend) ==="
docker inspect "$CONVEX_BACKEND_CONTAINER" --format '{{json .Config.Labels}}' | jq -r '
  to_entries[]
  | select(.key | test("^traefik\\.http\\.(routers|services|middlewares)\\."))
  | "\(.key)=\(.value)"' | sort

echo
echo "=== Env var names only (backend) ==="
docker inspect "$CONVEX_BACKEND_CONTAINER" \
  --format '{{range .Config.Env}}{{println .}}{{end}}' | cut -d= -f1 | sort

TRAEFIK_CONTAINER="$(docker ps --format '{{.Names}}' | grep -i traefik | head -1 || true)"
echo
echo "Traefik container: ${TRAEFIK_CONTAINER:-<not found>}"

echo
echo "=== Phase 3: Backend port mapping ==="
docker port "$CONVEX_BACKEND_CONTAINER" || true
docker inspect "$CONVEX_BACKEND_CONTAINER" --format '{{json .Config.ExposedPorts}}'
docker inspect "$CONVEX_BACKEND_CONTAINER" --format '{{json .NetworkSettings.Ports}}'

BACKEND_HOST_PORT="$(docker port "$CONVEX_BACKEND_CONTAINER" 3210/tcp 2>/dev/null | head -1 | awk -F: '{print $2}' || true)"
if [[ -z "$BACKEND_HOST_PORT" ]]; then
  echo "WARN: No published 3210/tcp mapping. Traefik may route via Docker network directly."
  BACKEND_HOST_PORT="3210"
  CURL_HOST="127.0.0.1"
else
  CURL_HOST="127.0.0.1"
fi
echo "Direct test target: http://${CURL_HOST}:${BACKEND_HOST_PORT}"

echo
echo "=== Phase 5: Direct backend health (no auth) ==="
curl -sS -i "http://${CURL_HOST}:${BACKEND_HOST_PORT}/" | head -20
echo "---"
curl -sS -i "http://${CURL_HOST}:${BACKEND_HOST_PORT}/instance_version" | head -20

echo
echo "=== Public URL health (no auth) ==="
curl -sS -i "https://api.sdvedutech.in/" | head -20
echo "---"
curl -sS -i "https://api.sdvedutech.in/instance_version" | head -20

echo
echo "=== Phase 5: Export route (optional — requires admin key) ==="
echo "To test POST /api/export/request/zip without shell history, run:"
cat <<'EOF'
read -s CONVEX_ADMIN_KEY
echo
curl -sS -i -X POST \
  "http://127.0.0.1:${BACKEND_HOST_PORT}/api/export/request/zip?includeStorage=true" \
  -H "Authorization: Convex ${CONVEX_ADMIN_KEY}" \
  -H "Content-Type: application/json"
unset CONVEX_ADMIN_KEY
EOF

echo
echo "=== Phase 4: Recent Traefik logs (if container found) ==="
if [[ -n "$TRAEFIK_CONTAINER" ]]; then
  docker logs --since 5m "$TRAEFIK_CONTAINER" 2>&1 | grep -E 'api\.sdvedutech\.in|export/request/zip' || echo "(no matching lines — access logging may be disabled)"
else
  echo "Traefik container not found."
fi

echo
echo "=== Phase 4: Recent backend logs ==="
docker logs --since 5m "$CONVEX_BACKEND_CONTAINER" 2>&1 | grep -E 'export/request/zip|/api/export' || echo "(no export requests in last 5m — run backup from dev machine while tailing logs)"

echo
echo "=== Expected routing ==="
echo "api.sdvedutech.in  -> Convex backend port 3210"
echo "site.sdvedutech.in -> Convex site proxy port 3211"
echo "Direct GET / should return: This Convex deployment is running..."
echo "Traefik 404 body '404 page not found' means no matching router to Convex."
