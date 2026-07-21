# Gap Task 1 Report: Legacy `.unique()` generation safety

**Status:** DONE  
**Branch:** `feat/analytics-export-pipeline`  
**Date:** 2026-07-21

## Summary

Introduced centralized legacy analytics rollup lookups so writers and readers no longer call `.unique()` on pre-cutover indexes (`by_municipality`, `by_municipality_date`, `by_municipality_ward`, `by_surveyor_municipality`) when generated rows can coexist. Legacy paths now take a bounded index page and select the row where `generation === undefined`; non-legacy generations continue to use generation-scoped indexes.

## Changes

### New: `packages/backend/convex/lib/surveyAnalyticsLookups.ts`

- `isLegacyAnalyticsRow`, `pickUniqueLegacyRow`, `filterLegacyAnalyticsRows`
- `getLegacy*StatsRow` helpers for all four rollup tables
- `get*StatsRowForGeneration` helpers (legacy filter vs generation index)
- Moved `LEGACY_GENERATION` / `AnalyticsGeneration` here; re-exported from `surveyAnalyticsWrites.ts`

### Updated writers: `surveyAnalyticsWrites.ts`

- Replaced inline legacy `.unique()` in `getMunicipalityStatsRow`, `getDailyStatsRow`, `getWardStatsRow`, `getSurveyorStatsRow` with generation-aware lookup helpers.

### Updated readers: `surveyScopeStats.ts`

- Dashboard KPI, scope summary, completion %, and daily trend paths use legacy lookup helpers or `filterLegacyAnalyticsRows` on range scans.

### Updated rollups: `surveyRollupStats.ts`

- Ward/surveyor get-or-create, scoped loads, and `flushBackfillAggregates` use legacy lookup helpers; list scans filter to legacy rows.

### Tests: `surveyAnalyticsLookups.test.ts`

- Unit tests for coexistence picking, null when only generated rows, duplicate-legacy error.
- `convex-test` integration test inserting legacy + generated municipality rows and asserting legacy row is returned.

## Verification

```bash
pnpm --filter @workspace/backend test    # 22 passed
pnpm --filter @workspace/backend typecheck
pnpm --filter @workspace/backend lint
```

## Self-review

| Check | Result |
|-------|--------|
| No legacy-index `.unique()` in analytics rollup lib files | Pass |
| Generation-scoped index when generation ≠ `"legacy"` | Pass |
| Legacy index + `generation === undefined` filter | Pass |
| Public API shapes unchanged | Pass |
| No building generation started | Pass |
| Unrelated tables (wards, taxRates, etc.) untouched | Pass |

## Out of scope (follow-up gap tasks)

- Reader switch to `readableAnalyticsGeneration()` once cutover activates (readers still intentionally target legacy rows today).
- Draft→draft dimension writes, completion fan-in, import atomicity, live KPI fallback removal.

## Concerns

None blocking. When active generation is switched away from `"legacy"`, readers in `surveyScopeStats.ts` / `surveyRollupStats.ts` will need a follow-up to read via `readableAnalyticsGeneration()` and generation indexes — this task only makes coexistence safe while active generation remains legacy.

---

## Follow-up fix (2026-07-21): Daily trend take budget

**Review finding:** Important — `loadDailyTrendFromDailyStats` used `.take(safeDays + 5)` then filtered to legacy rows; when generated rows coexist on `by_municipality_date`, the take window could fill with generated rows and silently drop legacy daily points.

**Fix:**
- Added `loadLegacyDailyStatsInDateRange` in `surveyAnalyticsLookups.ts` — paginates the municipality-date index through the full requested range and filters to `generation === undefined`.
- `loadDailyTrendFromDailyStats` now uses the paginated helper instead of `.take(safeDays + 5)`.
- Added `surveyScopeStats.test.ts` coexistence test (30-day window, generated + legacy per date); fails with old take budget (17/30 legacy days), passes after fix.

**Verification:**

```bash
pnpm --filter @workspace/backend test    # 23 passed (6 files)
```

**Commit:** `fix: paginate legacy daily trend under generation coexistence`
