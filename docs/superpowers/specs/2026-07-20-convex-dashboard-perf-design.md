# Convex dashboard performance design

**Date:** 2026-07-20  
**Status:** Approved for implementation

## Summary

Eliminate production Convex timeouts (`SystemTimeout`, 15s syscall limits, isolate restarts) on the web home dashboard by fixing query amplification in analytics helpers, wiring existing split APIs so KPIs paint independently of charts, and bounding P1 paths (Reports QC productivity, reassignment draft listing).

## Decisions

| Decision  | Choice                                                                                                   |
| --------- | -------------------------------------------------------------------------------------------------------- |
| Scope     | P0 + P1 (home hot path, Reports QC, reassignment drafts)                                                 |
| Migration | Wire UI to `counts` + `analyticsBundle` + `recentActivity`; keep `homeBundle` as thin deprecated wrapper |
| Approach  | Query rewrite + frontend split; no new schema/indexes                                                    |

## Goals

- Zero timeout-class failures on web home dashboard queries
- KPIs stream independently of charts and activity
- Individual home-path queries typically under ~500ms when stats are backfilled
- Preserve business rules and response field meanings

## Non-goals

- Full monorepo `.collect()` audit
- New tables or indexes
- Mobile dashboard rewrite
- Convex console `_system/frontend/paginatedTableDocuments`
- React.memo / useCallback sweeps

## Architecture

```
DashboardContent
  ├─ counts (KPI + QC ops)
  ├─ analyticsBundle (trend, wards, breakdown)
  └─ recentActivity (feed)
homeBundle → Promise.all([counts helpers, analytics helpers])  // compatibility only
```

### Backend fixes

1. **Daily trend** — one `by_municipality_date` range scan per municipality instead of O(days) `.unique()` calls
2. **QC daily trend** — `by_municipality_decided` per scoped municipality; drop per-reviewer sequential scans
3. **Rollups** — parallel municipality loads for ward/surveyor stats
4. **Recent activity** — bound multi-muni fan-out (≤ ~80 docs total, then top N)
5. **QC productivity** — municipality-scoped decisions for breakdown/Reports
6. **Reassignment drafts** — indexed `draft` status takes per municipality; no full survey collect

### Frontend

Preload `counts`, `analyticsBundle`, and `recentActivity` in parallel via `Promise.allSettled`. Independent section fallbacks. Stop calling `homeBundle` from the UI.

## Expected impact

| Path                      | Before         | After               |
| ------------------------- | -------------- | ------------------- |
| Daily created/submitted   | O(M×D) reads   | O(M) range reads    |
| QC daily trend            | O(Q×800)       | O(M×cap)            |
| Home UI                   | One mega-query | Split subscriptions |
| recentActivity multi-muni | M×40           | ≤ ~80 then top 20   |
| Reassignment drafts       | Full collect   | Indexed draft takes |

## Out of scope (later)

- User indexes by municipality + role
- Denormalized global activity feed
- Masters/RBAC/taxation collect cleanup
