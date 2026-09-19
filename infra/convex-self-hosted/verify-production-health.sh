#!/usr/bin/env bash
# Laptop/CI: verify public Convex production endpoints (read-only HTTP).
# Exit 0 only when API routing + liveness look healthy.
set -euo pipefail

API_HOST="${1:-api.sdvedutech.in}"
SITE_HOST="${2:-site.sdvedutech.in}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${SCRIPT_DIR}/verify-convex-traefik-routing.sh" "$API_HOST" "$SITE_HOST"
