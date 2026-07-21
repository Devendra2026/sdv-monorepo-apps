# Production Backend Recovery — 2026-07-21

Executed from the recovery plan. Global constraints: no data deletion, no API removals, no destructive schema changes.

## Changes delivered

### Task 1 — Command center + admin bounds

- `COMMAND_CENTER_WARD_SCAN_LIMIT`: 2500 → **800** (`surveys/helpers.ts`, `qc/helpers.ts`)
- `listPendingApprovals`: `.collect()` → `.take(200)`
- `pendingApprovalCount` / `countActiveUsers` / `countDisabledUsers`: bounded `.take()` helpers

### Task 2 — QC / analytics caps

- QC decisions per ULB: 400 → **200**; max ULBs in QC fan-out: **12**
- User role loads: `.collect()` → `.take(200)` per ULB
- Ward/surveyor rollups: per-muni take + ULB budget (`ROLLUP_ULB_CAP = 40`)

### Task 3 — Self-hosted Docker surface restored

- `infra/convex-self-hosted/docker-compose.yml` (3210 API / 3211 site, cheap `/version` healthcheck, Traefik labels)
- `infra/convex-self-hosted/README.md`
- `infra/convex-self-hosted/verify-convex-traefik-routing.sh`

### Task 4 — Next health + SSR resilience

- `GET /health` (no Clerk/Convex); excluded from Clerk middleware matcher
- `dashboard-home-section.tsx` uses `Promise.allSettled`
- `railpack.json` documents `HEALTHCHECK_PATH=/health`

### Task 5 — Security (guards only; signatures unchanged)

- `resolveTenantScope`: catalog fallback **disabled** for field roles (empty scope)
- `approveUser` / `updateUser`: only `admin` may grant/change admin role
- `updateRole`: block permissionKeys / deactivate on `isSystem` roles
- Next security headers (CSP, frame-ancestors, nosniff, HSTS in prod)

## Operator follow-ups (not automated)

1. **Rotate secrets** if live Clerk `sk_live_*` or `CONVEX_SELF_HOSTED_ADMIN_KEY` ever lived in mobile `.env.prod*`:
   - Rotate Clerk secret in Clerk Dashboard
   - Generate new Convex self-hosted admin key; update Dokploy + `packages/backend/.env.production`
   - Keep only `EXPO_PUBLIC_*` in the mobile app tree
2. Point Dokploy Next health probe at `GET /health` on port **3000**
3. Apply `infra/convex-self-hosted/` on the host; run `verify-convex-traefik-routing.sh`
4. After deploy, if large-tenant KPIs are zeros: run `internal.stats.internal.backfillSurveyRollups` (**without** `reset` unless explicitly approved)

## Post-audit follow-up

Late read-only audits ([Convex hotpaths](90cb32bc-f212-457b-b1e9-2bea37b3c1da), [architecture](9d535b35-ae2a-45f7-b406-6312b38c1cde), [runtime](c30b9fc9-8a77-4a5c-b679-e6faebb993d2), [security](6c785b17-8fa1-431f-9e2a-1ddae45a3eba)) largely described pre-fix state. Material items were already closed in Tasks 1–5. Extra correctness fix: `masters.queries.dashboardCounts` now requires `nowMs` (no `Date.now()` in the query).

Still operator-only / later: secret rotation (H1), optional `@convex-dev/rate-limiter`, bulk return-validator sweep, true cursor pagination.

## Verification

See Task 6 commands in the recovery plan (`pnpm typecheck` / `lint` / `build` scoped to backend + web).
