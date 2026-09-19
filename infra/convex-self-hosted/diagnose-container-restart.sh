#!/usr/bin/env bash
# Classify Convex backend restart mode (A–E). Read-only. Run on Dokploy host.
# Modes:
#   A = healthcheck / orchestrator recreate
#   B = process exit nonzero
#   C = OOMKilled
#   D = panic/FATAL in logs
#   E = running but never healthy
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Full host inspect (read-only) ==="
CONVEX_BACKEND_CONTAINER="${CONVEX_BACKEND_CONTAINER:-}" bash "${SCRIPT_DIR}/inspect-convex-host.sh" || true
echo

CONTAINER="${CONVEX_BACKEND_CONTAINER:-}"
if [[ -z "$CONTAINER" ]]; then
  CONTAINER="$(docker ps -a --format '{{.Names}}\t{{.Image}}' | grep -iE 'convex-backend|backend.*convex' | head -1 | awk '{print $1}' || true)"
fi
if [[ -z "$CONTAINER" ]]; then
  echo "Set CONVEX_BACKEND_CONTAINER to classify restarts."
  exit 1
fi

echo "=== Restart mode classification ($CONTAINER) ==="
OOM="$(docker inspect "$CONTAINER" --format '{{.State.OOMKilled}}')"
EXIT="$(docker inspect "$CONTAINER" --format '{{.State.ExitCode}}')"
RUNNING="$(docker inspect "$CONTAINER" --format '{{.State.Running}}')"
RESTARTS="$(docker inspect "$CONTAINER" --format '{{.RestartCount}}')"
HEALTH="$(docker inspect "$CONTAINER" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}')"
FAILS="$(docker inspect "$CONTAINER" --format '{{if .State.Health}}{{.State.Health.FailingStreak}}{{else}}0{{end}}')"

MODE="unknown"
REASON=""

if [[ "$OOM" == "true" ]]; then
  MODE="C"
  REASON="OOMKilled=true — raise memory limit/reservation; do not delete volume."
elif docker logs --tail 300 "$CONTAINER" 2>&1 | grep -qiE 'panic|FATAL'; then
  MODE="D"
  REASON="panic/FATAL in recent logs — capture full logs before any repair."
elif [[ "$RUNNING" == "true" && "$HEALTH" == "unhealthy" && "${RESTARTS:-0}" -eq 0 ]]; then
  MODE="E"
  REASON="Running but unhealthy with stable RestartCount — cold start or stuck bootstrap; check start_period and /version."
elif [[ "$HEALTH" == "unhealthy" || "${FAILS:-0}" -gt 0 ]]; then
  MODE="A"
  REASON="Health failing / unhealthy — compose start_period must cover SQLite cold start (900s)."
elif [[ "$EXIT" != "0" && "$RUNNING" != "true" ]]; then
  MODE="B"
  REASON="ExitCode=$EXIT — process exited; inspect logs for cause."
elif [[ "${RESTARTS:-0}" -gt 0 ]]; then
  MODE="A"
  REASON="RestartCount=$RESTARTS — orchestrator/health-driven recreates likely."
else
  MODE="ok"
  REASON="No restart/health failure signals in inspect snapshot."
fi

echo "MODE=$MODE"
echo "REASON=$REASON"
echo "OOMKilled=$OOM ExitCode=$EXIT Running=$RUNNING RestartCount=$RESTARTS Health=$HEALTH FailingStreak=$FAILS"
echo "See docs/superpowers/specs/2026-09-19-convex-backend-unhealthy-startup-design.md"
