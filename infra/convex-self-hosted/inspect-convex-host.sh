#!/usr/bin/env bash
# Read-only host diagnostics for self-hosted Convex on Dokploy.
# Run on the Docker host. Does not modify volumes, prune data, or VACUUM SQLite.
set -euo pipefail

echo "=== Host disk ==="
df -h || true
echo

echo "=== Docker disk summary ==="
docker system df || true
echo

echo "=== Convex-related containers ==="
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' | head -1
docker ps -a --format '{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' | grep -iE 'convex|backend' || echo "(no matching containers)"
echo

CONTAINER="${CONVEX_BACKEND_CONTAINER:-}"
if [[ -z "$CONTAINER" ]]; then
  CONTAINER="$(docker ps --format '{{.Names}}\t{{.Image}}' | grep -i convex-backend | head -1 | awk '{print $1}' || true)"
fi
if [[ -z "$CONTAINER" ]]; then
  CONTAINER="$(docker ps -a --format '{{.Names}}\t{{.Image}}' | grep -iE 'convex.*backend|backend.*convex' | head -1 | awk '{print $1}' || true)"
fi

if [[ -z "$CONTAINER" ]]; then
  echo "Set CONVEX_BACKEND_CONTAINER to inspect a specific container."
  exit 0
fi

echo "Using CONTAINER=$CONTAINER"
echo

echo "=== Restart / OOM evidence (container layer) ==="
docker inspect "$CONTAINER" --format \
'Name={{.Name}}
Image={{.Config.Image}}
Status={{.State.Status}}
Running={{.State.Running}}
RestartCount={{.RestartCount}}
OOMKilled={{.State.OOMKilled}}
ExitCode={{.State.ExitCode}}
Error={{.State.Error}}
StartedAt={{.State.StartedAt}}
FinishedAt={{.State.FinishedAt}}
Health={{if .State.Health}}{{.State.Health.Status}} fails={{.State.Health.FailingStreak}}{{else}}none{{end}}'
echo

echo "=== Mounts (look for /convex/data) ==="
docker inspect "$CONTAINER" --format '{{range .Mounts}}Type={{.Type}} Source={{.Source}} Destination={{.Destination}}{{println}}{{end}}'
echo

echo "=== Resource limits (HostConfig) ==="
docker inspect "$CONTAINER" --format \
'Memory={{.HostConfig.Memory}} NanoCpus={{.HostConfig.NanoCpus}} MemoryReservation={{.HostConfig.MemoryReservation}} RestartPolicy={{.HostConfig.RestartPolicy.Name}}'
echo

echo "=== Live stats (1 sample) ==="
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}' "$CONTAINER" || true
echo

echo "=== Data dir sizes inside container (read-only) ==="
docker exec "$CONTAINER" sh -c '
  set -e
  data="${DATA_DIR:-/convex/data}"
  echo "DATA_DIR=$data"
  if [ -d "$data" ]; then
    du -sh "$data" 2>/dev/null || true
    du -sh "$data"/* 2>/dev/null | head -40 || true
    ls -lah "$data" 2>/dev/null | head -30 || true
    if [ -f "$data/db.sqlite3" ]; then
      ls -lah "$data"/db.sqlite3 "$data"/db.sqlite3-wal "$data"/db.sqlite3-shm 2>/dev/null || ls -lah "$data"/db.sqlite3
    fi
  else
    echo "WARN: $data not found"
  fi
' || echo "WARN: docker exec failed (container not running?)"
echo

echo "=== Healthcheck log (last entries) ==="
docker inspect "$CONTAINER" --format '{{if .State.Health}}{{range .State.Health.Log}}{{.Start}} exit={{.ExitCode}} out={{printf "%.200s" .Output}}{{println}}{{end}}{{else}}(no Health config){{end}}' 2>/dev/null | tail -10 || echo "(health log unavailable)"
echo

echo "=== In-container GET /version (liveness) ==="
if docker exec "$CONTAINER" sh -c 'command -v curl >/dev/null && curl -sf -o /tmp/convex-version-body -w "http=%{http_code} time_total=%{time_total}\n" --max-time 10 http://127.0.0.1:3210/version && head -c 120 /tmp/convex-version-body && echo' 2>/dev/null; then
  :
else
  echo "WARN: in-container /version probe failed (process still booting, curl missing, or HTTP down)"
fi
echo

echo "=== Recent logs: isolate vs process signals ==="
docker logs --tail 200 "$CONTAINER" 2>&1 | grep -E 'Restarting Isolate|UnhandledPromiseRejection|UserTimeout|SystemTimeout|OOM|panic|out of memory|no space left|Health check|Bootstrapping indexes|Starting a Convex backend|Connected to SQLite' || echo "(no matching lines in last 200 log lines)"
echo

echo "=== Interpretation hints ==="
echo "- RestartCount/OOMKilled rising => container/process layer (limits, disk, panic)."
echo "- 'Restarting Isolate' with RestartCount stable => application isolate (Convex functions)."
echo "- Searchlight then multi-minute gap before Bootstrapping indexes => SQLite cold start (raise start_period only after measuring; prefer Postgres for large DBs)."
echo "- Health exit!=0 while bootstrapping => start_period too short vs cold start (see compose start_period: 900s)."
echo "- Do NOT run VACUUM/PRAGMA on live db.sqlite3; use logical export + maintenance window."
echo "- Full diagnosis: docs/superpowers/specs/2026-09-19-convex-backend-unhealthy-startup-design.md"