# Convex query timeout fix — design

**Date:** 2026-09-19  
**Status:** Implemented  
**Scope:** Self-hosted Convex production SystemTimeout / queryStreamNext starvation

See also: [docs/superpowers/README.md](../README.md) · [unhealthy startup](./2026-09-19-convex-backend-unhealthy-startup-design.md)

## Problem

Production logs showed multi-second to 200s+ timeouts on surveys, analytics, and masters queries, collateral timeouts on currentUser, WebSocket resets (symptom), and ETL audit HTTP 404s.

## Root cause

Too many concurrent indexed range streams (`database_syscall … queryStreamNext`) for admin / large multi-ULB scopes — not missing survey status indexes.

Primary amplifiers:

1. `queryAdminScopeSurveys` — unbounded Promise.all over every municipality
2. `loadWardStatsForScope` — uncapped parallel ward-stats reads (full scope for KPI parity)
3. Concurrent home dashboard subscriptions competing for the same syscall budget
4. `masters.bundle` with includeWards — uncapped parallel ward collects
5. (follow-up) `loadActiveMunicipalitiesForDistricts` — unbounded Promise.all over districts

## Approach

Stream budget control via sequential chunking (`mapInChunks`, chunk size 12). Same documents read; same filters, sorts, permissions, and KPI semantics. No timeout increases; no analytics redesign; no random indexes.

## Changes

| Area | Change |
|------|--------|
| lib/mapPool.ts | Added mapInChunks |
| lib/budgetLimits.ts | STREAM_FANOUT_CHUNK_SIZE = 12 |
| shared/fieldAccess.ts | Chunk admin survey fan-out |
| shared/tenancy.ts | Chunk district→municipality active catalog loads |
| surveys/helpers.ts | Chunk multi-ULB listPaginated collects |
| surveys/queries.ts | Bound storage.getUrl via mapPool |
| lib/surveyRollupStats.ts | Chunk ward + surveyor stats loads |
| analytics/queries.ts | Chunk QC/user fan-outs |
| masters/helpers.ts | Chunk ward loads |
| http.ts | Document ETL URL; alias /http/etl/audit/* |

## ETL 404

Canonical route: POST `{CONVEX_SITE_URL}/etl/audit/list` on site host. Wrong: `/http/...` prefix, API host, Nest. Aliases added for misconfigured clients. Redeploy if site path still 404s.

## Frontend

DashboardContent alone mounts; DashboardHomeSection unused. No UI change.

## Measured timings (24 ULBs synthetic)

| Query | After (ms) |
|-------|------------|
| currentUser | 47 |
| surveys.list | 240 |
| surveys.listPaginated | 36 |
| surveys.get | 1 |
| analytics.counts | 34 |
| analytics.recentActivity | 5 |
| analytics.analyticsBundle | 19 |
| analytics.qcSupervisorBundle | 2 |
| masters.dashboardCounts | 23 |
| masters.bundle | 5 |

Production before: 47s–200s+ class failures from logs only.

## Production deploy

After Docker backend is healthy (`GET /version` 200):

```bash
pnpm convex:deploy:production
pnpm --filter @workspace/backend test
bash infra/convex-self-hosted/verify-production-health.sh
```
