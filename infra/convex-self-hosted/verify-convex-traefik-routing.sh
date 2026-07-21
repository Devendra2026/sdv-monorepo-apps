#!/usr/bin/env bash
# Verify Traefik → Convex self-hosted routing for Dokploy.
# Usage: ./verify-convex-traefik-routing.sh [api-host] [site-host]
# Non-destructive: HTTP GETs only.
set -euo pipefail

API_HOST="${1:-api.sdvedutech.in}"
SITE_HOST="${2:-site.sdvedutech.in}"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

echo "== Convex API ($API_HOST) GET / =="
API_CODE=$(curl -sS -o "$tmpdir/api-body.txt" -w "%{http_code}" --max-time 20 "https://${API_HOST}/" || true)
API_BODY=$(head -c 200 "$tmpdir/api-body.txt" || true)
echo "HTTP $API_CODE"
echo "$API_BODY"
echo

echo "== Convex liveness GET /version =="
VERSION_CODE=$(curl -sS -o "$tmpdir/version-body.txt" -w "%{http_code}" --max-time 20 "https://${API_HOST}/version" || true)
VERSION_BODY=$(head -c 200 "$tmpdir/version-body.txt" || true)
echo "HTTP $VERSION_CODE body=${VERSION_BODY}"
echo

echo "== Site / HTTP actions origin ($SITE_HOST) GET / =="
SITE_CODE=$(curl -sS -o "$tmpdir/site-body.txt" -w "%{http_code}" --max-time 20 "https://${SITE_HOST}/" || true)
echo "HTTP $SITE_CODE"
head -c 200 "$tmpdir/site-body.txt" || true
echo

fail=0

if [[ "$API_CODE" == "404" && "$API_BODY" == *"404 page not found"* ]]; then
  echo "FAIL: Traefik is answering, but nothing is routed to Convex :3210."
  echo "In Dokploy, map ${API_HOST} to the backend container port 3210 (not 3000/6791/3211)."
  fail=1
fi

if [[ "$API_CODE" == "000" || "$API_CODE" == "502" || "$API_CODE" == "503" || "$API_CODE" == "504" ]]; then
  echo "FAIL: Could not reach a healthy Convex API at https://${API_HOST}/ (DNS/TLS/firewall/backend down)."
  fail=1
fi

if [[ "$VERSION_CODE" != "200" ]]; then
  echo "WARN: GET /version did not return HTTP 200 (got ${VERSION_CODE}). Liveness probe used by compose may fail."
  # Not always fatal if GET / is clearly Convex — still surface for operators.
fi

if [[ "$API_BODY" == *"This Convex deployment is running"* ]]; then
  echo "OK: API host returns Convex running text."
elif [[ "$fail" -eq 0 ]]; then
  echo "WARN: API host responded but body is not the expected Convex running text. Confirm you are not hitting Next.js."
fi

exit "$fail"
