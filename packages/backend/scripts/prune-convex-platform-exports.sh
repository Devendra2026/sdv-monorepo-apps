#!/usr/bin/env bash
# Safely prune Convex PLATFORM snapshot export blobs on the Dokploy/EC2 host.
#
# Target: /convex/data/storage/exports/*.blob (and sibling files)
# Written by: application::exports::worker after CLI/dashboard
#              POST /api/export/request/zip (NOT by convex/crons.ts retention).
#
# Safety defaults (production-safe):
#   - DRY_RUN=1 by default — lists candidates, deletes nothing
#   - Never deletes the newest KEEP_NEWEST files
#   - Never deletes files younger than MIN_AGE_HOURS
#   - Reminds you to take a volume backup first
#
# Usage (on the Linux host):
#   # 1) List only (default)
#   bash packages/backend/scripts/prune-convex-platform-exports.sh
#
#   # 2) After confirming a volume backup exists off-host:
#   DRY_RUN=0 KEEP_NEWEST=2 MIN_AGE_HOURS=24 \
#     bash packages/backend/scripts/prune-convex-platform-exports.sh
#
# Optional:
#   CONVEX_BACKEND_CONTAINER=...  EXPORTS_DIR=/convex/data/storage/exports
#
set -euo pipefail

DRY_RUN="${DRY_RUN:-1}"
KEEP_NEWEST="${KEEP_NEWEST:-2}"
MIN_AGE_HOURS="${MIN_AGE_HOURS:-24}"
EXPORTS_DIR="${EXPORTS_DIR:-/convex/data/storage/exports}"

echo "=== Convex platform export prune ==="
echo "DRY_RUN=$DRY_RUN  KEEP_NEWEST=$KEEP_NEWEST  MIN_AGE_HOURS=$MIN_AGE_HOURS"
echo
echo "Prerequisite: copy a volume backup OFF this host before DRY_RUN=0."
echo "  bash packages/backend/scripts/backup-convex-volume.sh"
echo

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
  exit 1
fi

echo "Container: $CONVEX_BACKEND_CONTAINER"
echo "Exports dir (in container): $EXPORTS_DIR"
echo

# List files with mtime + size inside the container (read-only).
mapfile -t FILES < <(
  docker exec "$CONVEX_BACKEND_CONTAINER" sh -c "
    if [ ! -d '$EXPORTS_DIR' ]; then
      echo 'MISSING_DIR' >&2
      exit 0
    fi
    # Newest first: mtime desc
    find '$EXPORTS_DIR' -maxdepth 1 -type f -printf '%T@ %s %p\n' 2>/dev/null \
      | sort -nr
  "
)

if [[ "${FILES[0]:-}" == *"MISSING_DIR"* ]] || [[ ${#FILES[@]} -eq 0 ]]; then
  echo "No export files found (or directory missing). Nothing to do."
  exit 0
fi

echo "Current export artifacts (newest first):"
printf '%s\n' "${FILES[@]}" | awk '{
  ts=$1; size=$2; $1=""; $2=""; path=$0;
  gsub(/^ +/,"",path);
  printf "  %.0f bytes  %s\n", size, path
}'
echo

NOW_EPOCH="$(date +%s)"
MIN_AGE_SECS=$((MIN_AGE_HOURS * 3600))
INDEX=0
DELETE_CANDIDATES=()

while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  mtime_epoch="${line%% *}"
  mtime_epoch="${mtime_epoch%%.*}"
  rest="${line#* }"
  size="${rest%% *}"
  path="${rest#* }"
  INDEX=$((INDEX + 1))

  age=$((NOW_EPOCH - mtime_epoch))
  if (( INDEX <= KEEP_NEWEST )); then
    echo "KEEP (newest #$INDEX): $path ($size bytes)"
    continue
  fi
  if (( age < MIN_AGE_SECS )); then
    echo "KEEP (younger than ${MIN_AGE_HOURS}h): $path"
    continue
  fi
  DELETE_CANDIDATES+=("$path")
  echo "CANDIDATE delete: $path ($size bytes, age ${age}s)"
done <<< "$(printf '%s\n' "${FILES[@]}")"

echo
if [[ ${#DELETE_CANDIDATES[@]} -eq 0 ]]; then
  echo "No candidates to delete under current KEEP_NEWEST / MIN_AGE_HOURS."
  exit 0
fi

if [[ "$DRY_RUN" != "0" ]]; then
  echo "DRY_RUN=1 — listed ${#DELETE_CANDIDATES[@]} candidate(s), deleted 0."
  echo "Re-run with DRY_RUN=0 after an off-host volume backup to prune."
  exit 0
fi

echo "Deleting ${#DELETE_CANDIDATES[@]} file(s)..."
for path in "${DELETE_CANDIDATES[@]}"; do
  docker exec "$CONVEX_BACKEND_CONTAINER" rm -f -- "$path"
  echo "Deleted: $path"
done

echo
echo "Done. Re-check disk:"
echo "  docker exec $CONVEX_BACKEND_CONTAINER du -sh $EXPORTS_DIR"
echo
echo "Also stop the source of new blobs: pause host cron/Dokploy jobs that call"
echo "  npx convex export / POST /api/export/request/zip"
echo "until disk is healthy. Failed exports often leave multi-GB .blob leftovers."
