#!/usr/bin/env bash
# Full physical backup of self-hosted Convex data volume (/convex/data).
#
# Use this when `pnpm convex:backup` fails with:
#   POST .../api/export/request/zip → 404
# (common when Traefik does not forward /api/export/* to the backend).
#
# Run ON the Dokploy / EC2 host (Linux), not on your Windows laptop.
# Does not modify production data — read-only copy of the data directory.
#
# Usage:
#   bash packages/backend/scripts/backup-convex-volume.sh
#   CONVEX_BACKEND_CONTAINER=my-backend OUT_DIR=/var/backups/convex \
#     bash packages/backend/scripts/backup-convex-volume.sh
#
set -euo pipefail

OUT_DIR="${OUT_DIR:-$HOME/convex-backups}"
STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
ARCHIVE="${OUT_DIR}/convex-data-${STAMP}.tar.gz"

echo "=== Find Convex backend container ==="
CONVEX_BACKEND_CONTAINER="${CONVEX_BACKEND_CONTAINER:-}"
if [[ -z "$CONVEX_BACKEND_CONTAINER" ]]; then
  CONVEX_BACKEND_CONTAINER="$(
    docker ps --format '{{.Names}}\t{{.Image}}' \
      | grep -iE 'convex-backend|convex_backend|backend.*convex|convex.*backend' \
      | head -1 \
      | awk '{print $1}'
  )"
fi

if [[ -z "$CONVEX_BACKEND_CONTAINER" ]]; then
  echo "ERROR: Set CONVEX_BACKEND_CONTAINER to your Convex backend container name."
  echo "Hint: docker ps --format '{{.Names}}\t{{.Image}}' | grep -i convex"
  exit 1
fi

echo "Using container: $CONVEX_BACKEND_CONTAINER"
mkdir -p "$OUT_DIR"

echo
echo "=== Snapshot /convex/data → $ARCHIVE ==="
# Prefer tar from a sidecar that mounts the same named volume. If the volume
# name is unknown, fall back to docker cp from the running container.
VOLUME_NAME="$(
  docker inspect "$CONVEX_BACKEND_CONTAINER" \
    --format '{{range .Mounts}}{{if eq .Destination "/convex/data"}}{{.Name}}{{end}}{{end}}' \
    2>/dev/null || true
)"

if [[ -n "$VOLUME_NAME" ]]; then
  echo "Data volume: $VOLUME_NAME"
  docker run --rm \
    -v "${VOLUME_NAME}:/convex/data:ro" \
    -v "${OUT_DIR}:/backup" \
    alpine:3.20 \
    tar -C /convex/data -czf "/backup/convex-data-${STAMP}.tar.gz" .
else
  echo "WARN: Could not resolve named volume for /convex/data — using docker cp."
  TMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$TMP_DIR"' EXIT
  docker cp "${CONVEX_BACKEND_CONTAINER}:/convex/data/." "$TMP_DIR/"
  tar -C "$TMP_DIR" -czf "$ARCHIVE" .
fi

SIZE="$(stat -c%s "$ARCHIVE" 2>/dev/null || stat -f%z "$ARCHIVE")"
echo
echo "Backup complete: $ARCHIVE"
echo "Size: $SIZE bytes"
echo
echo "Copy this archive OFF the host (S3 / offline media). Same-disk copies are not DR."
echo
echo "Optional — also try logical export via loopback (if backend publishes 3210):"
echo "  BACKEND_HOST_PORT=\$(docker port $CONVEX_BACKEND_CONTAINER 3210/tcp | head -1 | awk -F: '{print \$2}')"
echo "  # Then from a machine that can reach the host, or on-host:"
echo "  # POST http://127.0.0.1:\$BACKEND_HOST_PORT/api/export/request/zip?includeStorage=true"
echo "  # with Authorization: Convex <ADMIN_KEY>"
