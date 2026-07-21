# Convex analytics refactor design

**Date:** 2026-07-21  
**Status:** Approved design; awaiting specification review

## Summary

Refactor the survey analytics read and write paths so historical dashboard metrics
come exclusively from transactionally maintained aggregate tables. The change
removes live survey scans, repeated tenant resolution, QC decision fan-out,
in-memory joins, and silent result caps from `surveyStatsBreakdown` and sibling
dashboard queries.

The public response contracts remain unchanged. Dashboard data wiring changes
from four analytics requests to one optimized bundle without changing visible UI
behavior or component props.

## Decisions

- Preserve API schemas while correcting incomplete, truncated, and inconsistent
  values.
- Preserve transactional freshness after survey, QC, reassignment, import, and
  progress writes.
- Support scopes of up to 100 municipalities and 5,000 surveyors without silent
  truncation.
- Use repaired dimensional rollups rather than whole-response snapshots.
- Treat aggregate documents as the computation cache and Convex query caching as
  the response cache.
- Measure a production-like p95 latency target below 500 ms. An absolute
  per-request guarantee is not technically possible because runtime scheduling
  and network latency are external to the function.
- Keep raw survey reads only for the bounded recent-activity feed.

## Current problems

`packages/backend/convex/analytics/queries.ts:surveyStatsBreakdown` currently:

- resolves authentication, capability, and tenant scope multiple times through
  nested helpers;
- reads up to 2,000 live surveys even when municipality rollups succeed;
- filters survey rows repeatedly in JavaScript;
- groups and joins survey, municipality, district, surveyor, and QC data in
  memory;
- performs up to one user query per role and municipality;
- performs up to one QC-decision query per municipality or reviewer;
- sorts large surveyor and QC arrays;
- contains an `O(M × N)` municipality lookup fallback;
- silently caps municipality, surveyor, user, ward, and QC result sets;
- mixes complete municipality rollups with truncated live surveyor data.

For an admin with healthy rollups, the approximate read count is
`7 + 4D + 3M + 3U`, where `D` is the district count, `M` is the municipality
count, and `U = min(M, 12)`. Missing rollups add live reads of up to 2,500
surveys per affected municipality. The bounded analytics path separately reads
up to 2,000 surveys.

Existing aggregate correctness issues include non-idempotent additive backfills,
unbounded reset mutations, timezone disagreement, inconsistent submitted-event
semantics, reassignment paths that skip rollups, completion percentage drift,
and partially rebuilt data becoming visible.

Despite the original problem statement, `surveyAggregateBuckets` and
`surveyDailyRollups` do not exist in the schema or repository history. They will
not be added as generic duplicates.

## Architecture

### Shared request context

Add a single internal `loadAnalyticsContext(ctx, filters?)` helper. It:

1. authenticates the current user;
2. checks `analytics.view`;
3. resolves tenant scope once;
4. validates district, municipality, and surveyor filters once;
5. computes the Asia/Kolkata date key from the caller-supplied `nowMs`;
6. returns immutable district and municipality IDs and lookup maps.

All analytics loaders receive this context. They must not independently resolve
auth, capability, or tenant scope.

### Aggregate ownership

Keep and repair:

- `surveyMunicipalityStats`: all-time municipality status and QC totals;
- `surveyDailyStats`: municipality-by-date event totals;
- `surveyWardStats`: municipality-by-ward coverage totals;
- `surveySurveyorStats`: surveyor-by-municipality status and QC totals.

Add:

- `surveyDistrictStats`: one all-time status/QC row per district;
- `surveyQcReviewerStats`: reviewer-by-municipality approved, rejected, and
  total decision counts;
- `surveyAnalyticsContributions`: one generation-scoped survey contribution
  snapshot per survey, used to make live updates and backfill retries
  idempotent;
- `qcAnalyticsContributions`: one generation-scoped contribution per immutable
  QC decision, used to prevent duplicate reviewer throughput;
- `surveyAnalyticsMeta`: active generation, backfill cursor, readiness, and
  cutover metadata.

Add compound indexes for every supported exact scope:

- generation + municipality;
- generation + district;
- generation + municipality + date;
- generation + surveyor + municipality;
- generation + reviewer + municipality;
- generation + municipality + ward.

Index names will list all indexed fields in schema order.

### Canonical counter semantics

- `total`, `drafts`, `submitted`, `approved`, `rejected`, and `pending` describe
  current survey state.
- Current-state counters are not mutually exclusive: a rejected survey may also
  be a draft. Consumers must not infer `total` by summing status and QC fields.
- Daily `created` counts survey creation events.
- Daily `submitted` counts submission events and is not removed by later
  approval, rejection, or reopening.
- Daily `approved` and `rejected` count QC decision events.
- All daily keys use Asia/Kolkata boundaries in runtime maintenance and
  backfill.
- QC supervisor throughput is derived from decision aggregates, not current
  survey QC state.

### Write path

Create focused plain TypeScript helpers:

- `applySurveyStatsInsert`
- `applySurveyStatsUpdate`
- `applySurveyStatsRemove`
- `applyQcDecisionStats`
- `applySurveyorReassignmentStats`
- `applyCompletionStats`

Each helper computes the before/after delta once and updates every affected
dimension in the same mutation transaction. All promises are awaited.

Every writer touching analytics dimensions must use these helpers:

- survey draft save and upsert;
- survey submit and delete;
- QC approve, reject, and reopen;
- import upsert;
- surveyor reassignment;
- completion percentage refresh and related progress writes.

Counter helpers validate invariants before patching. A negative or otherwise
impossible next value fails the transaction rather than silently committing
corrupt aggregate data.

## Optimized read path

### `surveyStatsBreakdown`

The public query keeps its current argument and return validators. Its handler
becomes a thin orchestration layer:

1. load analytics context once;
2. read all-time district/municipality rows with exact indexed lookups;
3. read today's daily rows with the municipality-date index;
4. read surveyor rows with municipality, district, or surveyor indexes according
   to the supplied filter;
5. read reviewer rows with exact scoped indexes;
6. load active users through compound municipality/status/role indexes in
   bounded parallel batches;
7. perform one linear response assembly pass.

It never reads `surveys` or `qcDecisions`, and it never uses a live-data fallback.

### Sibling loaders

- `counts` reuses municipality and current-day loaders.
- `dailyTrend` uses indexed municipality-date ranges and fills missing dates in
  a bounded array of at most 180 days.
- `wardCoverage` uses municipality-ward indexes.
- `analyticsBundle` reuses the same loaders rather than duplicating reads.
- `qcSupervisorBundle` uses reviewer aggregates, not decision documents.
- `recentActivity` remains a separate bounded, indexed query of at most 20
  surveys.
- `homeBundle` remains a compatibility wrapper.

Independent municipality reads are dispatched concurrently with `Promise.all`.
Each range uses `take()` with a documented cardinality bound. `.collect()` is
allowed only for demonstrably small configuration or permission sets; it is
forbidden for surveys, QC decisions, users, aggregate dimensions, and other
growing tables.

### Unified dashboard request

Add:

```ts
dashboardBundle({ nowMs, trendDays? })
  => { counts, analytics, qc, recentActivity }
```

The bundle authenticates and resolves scope once, then runs independent
aggregate loaders concurrently. The dashboard preload and fallback hooks switch
to this endpoint and adapt the result into existing component props. Existing
public analytics endpoints stay available with unchanged response shapes.

## Caching and invalidation

The aggregate tables are the durable computation cache. They contain only the
small fields needed by analytics queries, reducing bytes read and invalidation
scope compared with full survey documents.

Convex caches query results by arguments and read set. No second
whole-response cache is introduced because:

- arbitrary user allotments create combinatorial cache keys;
- transactional freshness would require high write fan-out;
- hot shared snapshot documents would create write contention;
- the dimensional rollups already remove the expensive computation.

## Migration and cutover

1. Add generation-aware schema fields, indexes, new aggregate tables, and
   metadata.
2. Deploy writers that maintain the active generation and the building
   generation during migration.
3. Run a cursor-based, self-scheduling internal backfill in bounded batches.
4. Use the generation-scoped survey and QC contribution rows to compare the
   previously applied contribution with the current source snapshot. Apply only
   the difference, then replace the contribution row in the same transaction.
   Retries and reruns therefore produce a zero delta.
5. Validate aggregate totals and representative breakdowns against source data.
6. Set `surveyAnalyticsMeta.readyAt` only after the full generation passes
   validation.
7. Switch readers atomically to the ready generation.
8. Remove live survey KPI fallbacks and obsolete truncation caps.
9. Switch dashboard data wiring to `dashboardBundle`.
10. Retire the old generation in bounded batches after an observation period.

Readers continue using the old generation until the new generation is ready.
They never expose a partially rebuilt generation.

## Error handling

- Existing auth and capability behavior remains unchanged.
- Existing nullable bundles remain nullable; `surveyStatsBreakdown` preserves
  its existing hard-error behavior.
- A generation that is not marked ready is never selected.
- Aggregate update failures roll back the source mutation so survey data and
  current aggregates cannot diverge.
- Backfill failures retain their cursor and can be retried idempotently.
- Missing rows in a ready generation are logged as invariant violations. The
  query returns schema-compatible zero values for that missing dimension and
  never falls back to a raw survey scan.

## Complexity and expected impact

### Before

- Database calls: approximately `7 + 4D + 3M + 3U`, plus fallback survey scans.
- Documents: up to 2,000 surveys on the normal reports path, up to 2,500 per
  municipality on fallback, up to 200 users and 200 decisions per municipality.
- CPU: repeated `O(N)` filtering/grouping, `O(M × N)` fallback lookup,
  `O(S log S)` surveyor sorting, and `O(Q log Q)` reviewer sorting.
- Memory: full survey and QC-decision documents retained for in-memory joins.

### After

- Database calls for `surveyStatsBreakdown`: one auth/scope resolution plus at
  most `6M + D` indexed ranges before strategy optimizations, where the six
  municipality ranges are municipality totals, daily totals, surveyor totals,
  reviewer totals, active surveyors, and active QC supervisors. Full-district
  scopes use district indexes to collapse compatible ranges; narrow and
  non-contiguous scopes retain exact municipality reads to preserve tenancy.
  No survey or QC-decision reads occur for historical analytics.
- Database calls for `dashboardBundle`: it shares those reads across widgets,
  adds one daily date-range and one ward range per municipality, and performs
  one bounded recent-activity read strategy. This replaces four public function
  transactions and their repeated auth/scope work with one transaction.
- Documents: only small aggregate and active-user rows needed by the response.
- CPU: `O(D + M + S + Q + W + M×T)` response assembly, where `T ≤ 180`;
  output ordering remains `O(S log S + Q log Q + W log W)` only where the API
  requires ranked arrays.
- Memory: `O(D + M + S + Q + W + M×T)` small projection rows, with no full
  survey payloads or decision history.
- Expected latency: remove the 15–21 second query-stream syscall and target
  p95 below 500 ms on production-like scale.
- Expected memory reduction: proportional to the full-survey/decision document
  size eliminated from the path; verify with fixture byte counts rather than an
  unsupported fixed percentage.

The primary latency gain comes from eliminating scanned documents and large
read payloads, not merely reducing the number of JavaScript loops.

## Testing and verification

Add Convex tests covering:

- insert, update, submit, approve, reject, reopen, reassign, delete, and import
  counter transitions;
- completion percentage changes;
- Asia/Kolkata date boundaries;
- daily event semantics after later state transitions;
- idempotent backfill retries and reruns;
- concurrent live writes during a building-generation backfill;
- generation readiness and atomic cutover;
- tenant, district, municipality, and surveyor filters;
- zero-count active surveyors and QC supervisors;
- parity of all existing public response validators and shared Zod schemas;
- scopes of 100 municipalities and 5,000 surveyors without truncation.

Verification gates:

- no historical analytics loader reads `surveys` or `qcDecisions`;
- no unbounded `.collect()` remains in the analytics path;
- every database range is indexed and bounded;
- repeated auth, tenancy, role, user, and aggregate calls are removed;
- active dashboard metrics are fetched by one public bundle;
- production-like benchmark p95 is below 500 ms;
- Convex insights show no timeout or excessive-read finding after rollout;
- ESLint, typecheck, Convex tests, and affected web tests pass.

## Documentation requirements

Production code will include concise comments at optimization boundaries:

- why a rollup replaces a source-table scan;
- why a specific index matches a filter;
- why a bound is safe for the chosen production scale;
- how generation cutover prevents partial analytics;
- why daily counters use event rather than current-state semantics.

Comments will explain non-obvious performance and correctness decisions rather
than narrating ordinary code.

## Non-goals

- UI redesign or component API changes;
- new report filters;
- Redis or another external cache;
- generic `surveyAggregateBuckets` or `surveyDailyRollups` duplicates;
- refactoring unrelated Convex modules.
