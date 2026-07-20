# Convex dashboard performance design

**Date:** 2026-07-20  
**Status:** Approved for implementation (Approach 2)

## Summary

Eliminate production Convex timeouts (`SystemTimeout`, 15s syscall limits, isolate restarts, `/api/query` 503s) by:

1. Slimming home `analyticsBundle` and extracting QC supervisor work into a sibling query
2. Hard-capping cold rollup live-scan fallbacks (prefer degraded KPIs over timeouts)
3. Cutting expensive `listPaginated` full-scan budgets
4. Bounding remaining P1 hotspots (QC parcel siblings, admin user counts, Reports QC path)

## Decisions

| Decision       | Choice                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------- |
| Scope          | P0 timeout killers + bounded P1                                                                                 |
| Rollups        | Prefer warm stats; cold path hard-caps / degrades — never unbounded live scans                                  |
| Home analytics | Keep slim `analyticsBundle`; add `qcSupervisorBundle` for QC tables                                             |
| listPaginated  | Keep offset API; lower scan budget (~500–800); use existing `scopeTruncated`                                    |
| Migration      | Wire UI to `counts` + `analyticsBundle` + `qcSupervisorBundle` + `recentActivity`; keep `homeBundle` deprecated |
| Indexes (P0)   | None new — existing municipality / rollup / QC indexes suffice                                                  |

## Goals

- Zero timeout-class failures on web home dashboard and survey list hot paths
- KPIs / charts / QC / activity subscribe independently
- Home loads under ~2s when rollups are warm; queries well under the 15s Convex limit
- Preserve business rules and intentional UI behavior

## Non-goals

- Raising Convex timeout limits
- True Convex `.paginate()` rewrite for surveys (later)
- Full monorepo `.collect()` audit
- New tables or indexes in P0
- Convex console `_system/frontend/paginatedTableDocuments`
- Layout / business-logic redesign

## Architecture

```
DashboardContent
  ├─ counts (KPI; rollup-first; degraded on cold)
  ├─ analyticsBundle (trend, wards, surveyor/district/ULB; no QC fan-out)
  ├─ qcSupervisorBundle (byQcSupervisor + qcSupervisors filter options)
  └─ recentActivity (feed, limit 20)
homeBundle → Promise.all([counts, analytics])  // compatibility only; unused by live UI
```

### P0 backend

1. **Slim `analyticsBundle`** — no `loadScopedQcDecisionsByReviewer`; empty `byQcSupervisor` / `qcSupervisors` in breakdown
2. **`qcSupervisorBundle`** — QC decision fan-out + qc_supervisor filter options only
3. **Scoped surveyor loads** — replace global `users.by_role_status` `.collect()` with rollup IDs + `db.get` / scoped municipality indexes
4. **Cold-rollup hard stop** — skip `computeLiveMunicipalitySnapshot` for large admin scopes; set `degraded`; parallelize rollup `.unique()` reads
5. **`listPaginated`** — lower `LIST_PAGINATED_SCOPE_LIMIT` from 5000 to ~500–800; keep `scopeTruncated`
6. **Parallel rollup helpers** — `Promise.all` ward/surveyor stats per municipality

### P0 frontend

Preload `counts`, `analyticsBundle`, `qcSupervisorBundle`, and `recentActivity` in parallel via `Promise.allSettled`. Wire overview / QC throughput to the QC query. Stop calling `homeBundle` from the UI.

### Bounded P1

1. QC `listParcelSiblings` — `take()` + cap instead of unbounded ward `.collect()`
2. Admin user counts — indexed / bounded takes
3. Reports `surveyStatsBreakdown` — municipality-scoped QC decisions (same helper as home QC bundle)
4. Optional: Suspense-wire existing home/activity RSC sections

## Expected impact

| Path                    | Before                                    | After                           |
| ----------------------- | ----------------------------------------- | ------------------------------- |
| Home analytics          | Bundle + QC × ULBs + global user collects | Slim rollups; QC sibling query  |
| Cold rollups            | Live `take(2500)×N`                       | Skip/cap + degraded             |
| listPaginated full scan | ≤5000 rows                                | ≤~500–800 + `scopeTruncated`    |
| Daily created/submitted | O(M×D) reads                              | O(M) range reads                |
| Dashboard TTFB          | Often timeout                             | Target &lt;2s when rollups warm |

## P1 index candidates (document only; not in P0)

- User indexes by municipality + role (if scoped user loads remain heavy)
- Search / submittedAt compound indexes for true cursor pagination later

## Out of scope (later)

- Denormalized global activity feed
- Masters/RBAC/taxation collect cleanup
- True cursor pagination for survey registry
