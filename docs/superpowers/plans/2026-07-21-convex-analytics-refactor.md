# Convex Analytics Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace timeout-prone survey analytics scans with transactionally maintained, generation-safe aggregates while preserving public response contracts and loading the dashboard through one query.

**Architecture:** A shared analytics context resolves auth and tenancy once. Generation-scoped municipality, district, daily, ward, surveyor, and QC-reviewer rollups are updated in the same transaction as source writes; idempotent contribution rows make backfills retry-safe. Public queries become thin indexed loaders, and a unified dashboard bundle reuses one read context.

**Tech Stack:** Convex 1.42, TypeScript 5.9 strict mode, Vitest, convex-test, React 19, Next.js, pnpm/Turborepo.

## Global Constraints

- Preserve every existing public analytics argument and return validator.
- Correct silent truncation and inconsistent totals; do not preserve incorrect values.
- Keep analytics transactionally current after source writes.
- Support at most 100 municipalities and 5,000 surveyors without silent truncation.
- Historical analytics must not read `surveys` or `qcDecisions`.
- Only `recentActivity` may read surveys, using an indexed bound of 20.
- Do not use `.collect()` on growing tables; every range must use an index and `take()` or pagination.
- Use Asia/Kolkata date keys for runtime writes and backfills.
- Keep dashboard component props and visible behavior unchanged.
- Benchmark target: production-like p95 below 500 ms; do not claim an absolute latency guarantee.
- Add concise comments only where they explain a non-obvious optimization, bound, event semantic, or generation rule.

---

## File Structure

### New backend files

- `packages/backend/convex/lib/surveyAnalyticsModel.ts` — pure snapshot, counter, date-event, and delta types/functions.
- `packages/backend/convex/lib/surveyAnalyticsWrites.ts` — transactional aggregate and contribution-row updates.
- `packages/backend/convex/lib/surveyAnalyticsReads.ts` — shared analytics context and bounded indexed loaders.
- `packages/backend/convex/lib/surveyAnalyticsModel.test.ts` — pure counter/date tests.
- `packages/backend/convex/analytics/queries.test.ts` — convex-test contract and aggregate-only read tests.
- `packages/backend/convex/stats/internal.test.ts` — idempotent backfill and generation cutover tests.
- `packages/backend/vitest.config.ts` — edge-runtime Convex test configuration.
- `packages/backend/eslint.config.mjs` — Convex recommended ESLint rules.

### Existing backend files

- `packages/backend/convex/schema.ts` — migration-safe optional generation fields on existing aggregates, required generation fields on new tables, contribution tables, and indexes.
- `packages/backend/convex/lib/surveyScopeStats.ts` — delegate maintained stats to the new writer module; remove scan fallbacks after cutover.
- `packages/backend/convex/lib/surveyRollupStats.ts` — retain compatibility types temporarily; remove additive backfill/reset implementation.
- `packages/backend/convex/stats/internal.ts` — generation lifecycle, cursor backfill, validation, and retirement.
- `packages/backend/convex/analytics/queries.ts` — preserve exports/validators and delegate to read loaders; add `dashboardBundle`.
- `packages/backend/convex/surveys/mutations.ts` — call the canonical writer after inserts/updates/deletes.
- `packages/backend/convex/qc/mutations.ts` — maintain survey-state and reviewer-decision aggregates.
- `packages/backend/convex/export/mutations.ts` — maintain aggregates for import upserts.
- `packages/backend/convex/reassignment/mutations.ts` — maintain surveyor aggregates during reassignment.
- `packages/backend/convex/lib/surveyProgress.ts` — route completion percentage changes through aggregate maintenance.
- `packages/backend/package.json` and `pnpm-lock.yaml` — test/lint tooling and scripts.
- `packages/backend/scripts/verify-convex-production-functions.mjs` — verify the new public bundle exists.

### Frontend files

- `apps/web/hooks/analytics/useAnalytics.ts` — one preloaded/client dashboard bundle hook.
- `apps/web/lib/convex-server.ts` — one cached dashboard preload.
- `apps/web/app/(dashboard)/dashboard/dashboard-content.tsx` — preload the unified bundle once.
- `apps/web/app/(dashboard)/dashboard/dashboard-home-client.tsx` — adapt the bundle to existing children.
- `apps/web/app/(dashboard)/dashboard/dashboard-home-fallback.tsx` — one fallback subscription.
- `apps/web/app/(dashboard)/dashboard/dashboard-activity-preloaded.tsx` — accept the dashboard bundle preload and extract `recentActivity`.

---

### Task 1: Install Test/Lint Harness and Define Pure Analytics Semantics

**Files:**

- Modify: `packages/backend/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `packages/backend/vitest.config.ts`
- Create: `packages/backend/eslint.config.mjs`
- Create: `packages/backend/convex/lib/surveyAnalyticsModel.ts`
- Create: `packages/backend/convex/lib/surveyAnalyticsModel.test.ts`

**Interfaces:**

- Produces: `SurveyAnalyticsSnapshot`, `SurveyStateCounters`, `DailyEventCounters`, `snapshotFromSurvey`, `diffSurveyCounters`, `dailyEventsForTransition`, and `assertValidCounterPatch`.
- Consumes: `Doc<"surveys">` and existing `formatDateKey` from `shared/calendar.ts`.

- [ ] **Step 1: Add backend test and Convex lint tooling**

Run:

```bash
pnpm add -D --filter @workspace/backend vitest@latest convex-test@latest @edge-runtime/vm@latest eslint@9.39.4 @convex-dev/eslint-plugin@latest
```

Add scripts:

```json
{
  "scripts": {
    "test": "vitest run --config vitest.config.ts",
    "lint": "eslint convex --max-warnings=0"
  }
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts"],
  },
});
```

Create `eslint.config.mjs`:

```js
import convex from "@convex-dev/eslint-plugin"

export default [...convex.configs.recommended]
```

- [ ] **Step 2: Write failing pure-model tests**

Cover these exact cases:

```ts
it("keeps submission events after approval", () => {
  const before = snapshot({ status: "submitted", submittedAt: IST_NOON });
  const after = snapshot({ status: "approved", qcStatus: "approved", submittedAt: IST_NOON });
  expect(dailyEventsForTransition(before, after)).toEqual([]);
});

it("counts each QC decision event on its IST day", () => {
  expect(qcDecisionDailyEvent("approve", IST_NOON)).toEqual({
    dateKey: "2026-07-21",
    approved: 1,
    rejected: 0,
  });
});

it("rejects negative aggregate patches", () => {
  expect(() => assertValidCounterPatch({ total: -1, drafts: 0, submitted: 0, qcApproved: 0, qcRejected: 0, qcPending: 0 }))
    .toThrow("Analytics counter underflow");
});
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```bash
pnpm --filter @workspace/backend test -- surveyAnalyticsModel.test.ts
```

Expected: FAIL because the model module and functions do not exist.

- [ ] **Step 4: Implement the pure model**

Implement current-state counters as overlapping dimensions:

```ts
export type SurveyStateCounters = {
  total: number;
  drafts: number;
  submitted: number;
  qcApproved: number;
  qcRejected: number;
  qcPending: number;
};

export function countersForSnapshot(snapshot: SurveyAnalyticsSnapshot): SurveyStateCounters {
  return {
    total: 1,
    drafts: snapshot.status === "draft" ? 1 : 0,
    submitted: snapshot.status === "submitted" ? 1 : 0,
    qcApproved: snapshot.qcStatus === "approved" ? 1 : 0,
    qcRejected: snapshot.qcStatus === "rejected" ? 1 : 0,
    qcPending: snapshot.status === "submitted" && snapshot.qcStatus === "pending" ? 1 : 0,
  };
}
```

Use `formatDateKey` for every timestamp. Submission events are created only on a transition into submitted state or a changed `submittedAt`; QC event functions consume immutable decision documents rather than deriving event history from current survey state.

- [ ] **Step 5: Run focused tests, lint, and typecheck**

Run:

```bash
pnpm --filter @workspace/backend test -- surveyAnalyticsModel.test.ts
pnpm --filter @workspace/backend lint
pnpm --filter @workspace/backend typecheck
```

Expected: all PASS with zero lint errors.

- [ ] **Step 6: Commit**

```bash
git add packages/backend/package.json packages/backend/vitest.config.ts packages/backend/eslint.config.mjs packages/backend/convex/lib/surveyAnalyticsModel.ts packages/backend/convex/lib/surveyAnalyticsModel.test.ts pnpm-lock.yaml
git commit -m "test: define survey analytics counter semantics"
```

---

### Task 2: Add Generation-Scoped Aggregate Schema

**Files:**

- Modify: `packages/backend/convex/schema.ts:450-506`
- Create: `packages/backend/convex/lib/surveyAnalyticsWrites.ts`
- Test: `packages/backend/convex/lib/surveyAnalyticsModel.test.ts`

**Interfaces:**

- Consumes: pure snapshot/counter functions from Task 1.
- Produces: `AnalyticsGeneration`, `getAnalyticsMeta`, `applySurveyAnalyticsTransition`, and `applyQcDecisionContribution`.

- [ ] **Step 1: Write failing schema/type tests**

Add compile-time fixtures that insert one row for each new table and assert generated IDs:

```ts
const generation = "v2";
const metaId: Id<"surveyAnalyticsMeta"> = await t.run(async (ctx) =>
  ctx.db.insert("surveyAnalyticsMeta", {
    key: "survey-analytics",
    activeGeneration: generation,
    buildingGeneration: null,
    backfillCursor: null,
  }),
);
expect(metaId).toBeDefined();
```

- [ ] **Step 2: Run the test and verify schema failure**

Run:

```bash
pnpm --filter @workspace/backend test -- surveyAnalyticsModel.test.ts
```

Expected: FAIL because generated table names and schema fields do not exist.

- [ ] **Step 3: Add schema fields and indexes**

Add `generation: v.optional(v.string())` to the four existing rollup tables so
legacy rows remain valid during rollout. Add required `generation: v.string()`
to every new table. Update legacy readers/writers in the same deployment to
address old rows through the generation index with an undefined generation;
otherwise the old single-dimension `.unique()` indexes would see both legacy
and v2 rows.

Extend daily stats with migration-safe optional event fields:

```ts
approved: v.optional(v.number()),
rejected: v.optional(v.number()),
```

Add:

```ts
surveyDistrictStats: defineTable({
  generation: v.string(),
  districtId: v.id("districts"),
  total: v.number(),
  drafts: v.number(),
  submitted: v.number(),
  qcApproved: v.number(),
  qcRejected: v.number(),
  qcPending: v.number(),
}).index("by_generation_and_districtId", ["generation", "districtId"]),

surveyQcReviewerStats: defineTable({
  generation: v.string(),
  reviewerId: v.id("users"),
  municipalityId: v.id("municipalities"),
  approved: v.number(),
  rejected: v.number(),
  total: v.number(),
})
  .index("by_generation_and_municipalityId", ["generation", "municipalityId"])
  .index("by_generation_and_reviewerId_and_municipalityId", ["generation", "reviewerId", "municipalityId"]),
```

Add contribution tables keyed by generation plus source ID, and one singleton metadata row keyed by `"survey-analytics"`. Use validators for every field; do not use `v.any()`.

Keep the old indexes until legacy rows are retired. A later cleanup deployment,
after production retirement succeeds, makes generation and daily event fields
required and removes redundant legacy indexes.

- [ ] **Step 4: Run Convex codegen**

Run:

```bash
pnpm --filter @workspace/backend codegen
```

Expected: generated model/API files update without schema errors.

- [ ] **Step 5: Implement generation-aware get-or-create writers**

Every writer must use an exact compound index and avoid the insert-then-get pattern:

```ts
async function getMunicipalityStats(ctx: MutationCtx, generation: string, municipalityId: Id<"municipalities">) {
  return await ctx.db
    .query("surveyMunicipalityStats")
    .withIndex("by_generation_and_municipalityId", (q) =>
      q.eq("generation", generation).eq("municipalityId", municipalityId),
    )
    .unique();
}
```

Insert missing zero rows and retain the returned ID directly. Apply validated deltas with awaited `ctx.db.patch`.

- [ ] **Step 6: Verify schema and writer types**

Run:

```bash
pnpm --filter @workspace/backend lint
pnpm --filter @workspace/backend typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/convex/schema.ts packages/backend/convex/lib/surveyAnalyticsWrites.ts packages/backend/convex/_generated
git commit -m "feat: add generation-scoped analytics aggregates"
```

---

### Task 3: Make Survey Lifecycle Writes Maintain All Dimensions

**Files:**

- Modify: `packages/backend/convex/surveys/mutations.ts`
- Modify: `packages/backend/convex/export/mutations.ts`
- Modify: `packages/backend/convex/lib/surveyScopeStats.ts`
- Modify: `packages/backend/convex/lib/surveyRollupStats.ts`
- Create: `packages/backend/convex/lib/surveyAnalyticsWrites.test.ts`

**Interfaces:**

- Consumes: `applySurveyAnalyticsTransition(ctx, before, after, generations)`.
- Produces: complete municipality, district, daily, ward, and surveyor updates plus contribution rows.

- [ ] **Step 1: Write failing convex-test lifecycle tests**

For each transition, assert all affected rows:

```ts
await t.mutation(api.surveys.mutations.saveDraft, draftArgs);
await t.mutation(api.surveys.mutations.submit, { id: surveyId });

const municipality = await readMunicipalityStats(t, generation, municipalityId);
const district = await readDistrictStats(t, generation, districtId);
const surveyor = await readSurveyorStats(t, generation, surveyorId, municipalityId);

expect(municipality).toMatchObject({ total: 1, drafts: 0, submitted: 1, qcPending: 1 });
expect(district).toMatchObject({ total: 1, submitted: 1, qcPending: 1 });
expect(surveyor).toMatchObject({ total: 1, submitted: 1 });
```

Also cover delete, municipality change, ward change, import insert, and import update.

- [ ] **Step 2: Run tests and verify missing generation updates**

Run:

```bash
pnpm --filter @workspace/backend test -- surveyAnalyticsWrites.test.ts
```

Expected: FAIL because lifecycle mutations do not call the new writer.

- [ ] **Step 3: Integrate one canonical transition call**

After computing the final source document, call:

```ts
await applySurveyAnalyticsTransition(ctx, beforeSurvey, afterSurvey, await writableAnalyticsGenerations(ctx));
```

Use `null` for insert/remove sides. Do not independently update old helpers in the same path, because that double-counts.

- [ ] **Step 4: Add contribution idempotency**

Within the same mutation:

1. load the contribution by generation and survey ID;
2. derive its old applied snapshot;
3. compare with the current source snapshot;
4. apply only the delta to all dimensions;
5. replace the contribution row with the current snapshot.

If the contribution already matches, return without writes.

- [ ] **Step 5: Remove duplicate old writer calls**

Turn `recordSurveyStatsInsert/Update/Remove` into temporary delegates to the new implementation for untouched callers. Remove additive logic only after all call sites compile against the canonical writer.

- [ ] **Step 6: Run lifecycle tests, lint, and typecheck**

Run:

```bash
pnpm --filter @workspace/backend test -- surveyAnalyticsWrites.test.ts
pnpm --filter @workspace/backend lint
pnpm --filter @workspace/backend typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/convex/surveys/mutations.ts packages/backend/convex/export/mutations.ts packages/backend/convex/lib/surveyScopeStats.ts packages/backend/convex/lib/surveyRollupStats.ts packages/backend/convex/lib/surveyAnalyticsWrites.test.ts
git commit -m "feat: maintain analytics across survey lifecycle"
```

---

### Task 4: Cover QC, Reassignment, and Completion Writers

**Files:**

- Modify: `packages/backend/convex/qc/mutations.ts`
- Modify: `packages/backend/convex/reassignment/mutations.ts`
- Modify: `packages/backend/convex/lib/surveyProgress.ts`
- Modify: `packages/backend/convex/surveys/mutations.ts`
- Test: `packages/backend/convex/lib/surveyAnalyticsWrites.test.ts`

**Interfaces:**

- Consumes: Task 2 writer APIs.
- Produces: transactionally correct current-state, QC event, reviewer throughput, surveyor reassignment, and completion aggregates.

- [ ] **Step 1: Write failing tests for each bypass**

Add tests proving:

- approve/reject changes current-state counters;
- each immutable QC decision increments exactly one reviewer daily/all-time event;
- replaying the same QC contribution is a no-op;
- reopen changes survey state but does not invent a QC decision;
- reassignment decrements the old surveyor and increments the new surveyor;
- completionPct updates adjust sum and count once.

- [ ] **Step 2: Run and verify failures**

Run:

```bash
pnpm --filter @workspace/backend test -- surveyAnalyticsWrites.test.ts
```

Expected: FAIL on QC reviewer, reassignment, and completion assertions.

- [ ] **Step 3: Integrate QC decisions**

After inserting `qcDecisions` and obtaining its ID, call:

```ts
await applyQcDecisionContribution(ctx, {
  decisionId,
  reviewerId: me._id,
  municipalityId: survey.municipalityId,
  decision: args.decision,
  decidedAt: now,
}, await writableAnalyticsGenerations(ctx));
```

Maintain the survey state through `applySurveyAnalyticsTransition`. Reopen has no reviewer event because no decision row is created.

- [ ] **Step 4: Integrate reassignment and completion**

Build before/after survey values before patching and pass them to the canonical transition writer. Remove direct source patches that bypass aggregate maintenance.

- [ ] **Step 5: Verify all source writers are covered**

Run:

```bash
rg "ctx\\.db\\.(patch|replace|insert|delete)\\(\\\"surveys\\\"" packages/backend/convex
```

For every match, document in the test file or code comment why it:

- calls the canonical transition writer; or
- changes no analytics dimension.

- [ ] **Step 6: Run tests and checks**

Run:

```bash
pnpm --filter @workspace/backend test -- surveyAnalyticsWrites.test.ts
pnpm --filter @workspace/backend lint
pnpm --filter @workspace/backend typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/convex/qc/mutations.ts packages/backend/convex/reassignment/mutations.ts packages/backend/convex/lib/surveyProgress.ts packages/backend/convex/lib/surveyAnalyticsWrites.test.ts
git commit -m "fix: close analytics writer consistency gaps"
```

---

### Task 5: Replace Additive Backfill with Generation-Safe Idempotent Backfill

**Files:**

- Modify: `packages/backend/convex/stats/internal.ts`
- Modify: `packages/backend/convex/lib/surveyRollupStats.ts`
- Create: `packages/backend/convex/stats/internal.test.ts`

**Interfaces:**

- Produces public-internal workflow:
  - `startSurveyAnalyticsBackfill({ generation, batchSize? })`
  - `backfillSurveyAnalyticsBatch({ generation, cursor, batchSize })`
  - `backfillQcAnalyticsBatch({ generation, cursor, batchSize })`
  - `validateSurveyAnalyticsGeneration({ generation, cursor?, batchSize? })`
  - `activateSurveyAnalyticsGeneration({ generation })`
  - `retireSurveyAnalyticsGeneration({ generation, table, cursor? })`

- [ ] **Step 1: Write failing backfill tests**

Test these invariants:

```ts
await backfillGeneration(t, "v2");
const first = await dumpGeneration(t, "v2");
await backfillGeneration(t, "v2");
expect(await dumpGeneration(t, "v2")).toEqual(first);
```

Also assert that a live write between batches appears exactly once and readers stay on `v1` until activation.

- [ ] **Step 2: Run and verify failure**

Run:

```bash
pnpm --filter @workspace/backend test -- internal.test.ts
```

Expected: FAIL because the current additive flush double-counts.

- [ ] **Step 3: Implement start and batch functions**

Use `paginationOpts`-equivalent explicit validators and return validators on every internal function. Clamp batch size to 200. Schedule only `internal.stats.internal.*` functions and await `ctx.scheduler.runAfter`.

Each survey page invokes the contribution-aware writer for the building generation. Each QC-decision page invokes the QC contribution writer.

- [ ] **Step 4: Implement validation and activation**

Validation compares bounded source samples and aggregate invariants, records progress in `surveyAnalyticsMeta`, and only allows activation after both survey and QC cursors are done.

Activation must be a single metadata patch:

```ts
await ctx.db.patch(meta._id, {
  activeGeneration: args.generation,
  buildingGeneration: null,
  readyAt: Date.now(),
});
```

- [ ] **Step 5: Replace destructive reset**

Remove `clearAllRollupStats` and all unbounded `.collect()` calls. Retirement paginates one table at a time and self-schedules until complete.

- [ ] **Step 6: Run backfill tests and checks**

Run:

```bash
pnpm --filter @workspace/backend test -- internal.test.ts
pnpm --filter @workspace/backend lint
pnpm --filter @workspace/backend typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/convex/stats/internal.ts packages/backend/convex/stats/internal.test.ts packages/backend/convex/lib/surveyRollupStats.ts
git commit -m "feat: add idempotent analytics generation backfill"
```

---

### Task 6: Refactor `surveyStatsBreakdown` to Aggregate-Only Reads

**Files:**

- Create: `packages/backend/convex/lib/surveyAnalyticsReads.ts`
- Modify: `packages/backend/convex/analytics/queries.ts:797-1038`
- Create: `packages/backend/convex/analytics/queries.test.ts`

**Interfaces:**

- Produces:
  - `loadAnalyticsContext(ctx, me, filters, nowMs)`
  - `loadStatsBreakdown(ctx, context)`
  - `loadDailyTrend(ctx, context, days)`
  - `loadWardCoverage(ctx, context)`
  - `loadQcSupervisorBreakdown(ctx, context)`
- Preserves the existing `surveyStatsBreakdown` validator and response shape exactly.

- [ ] **Step 1: Write response parity tests**

Seed two districts, municipalities, active surveyors, reviewers, and aggregate rows. Assert the full response object, including zero-count active users and filter options.

Add a guard that fails if historical analytics requests read source tables. Implement it by seeding malformed/oversized source surveys and proving the result depends only on aggregates, plus static assertions:

```bash
rg "query\\(\\\"(surveys|qcDecisions)\\\"\\)|db\\.get\\(\\\"(surveys|qcDecisions)\\\"" packages/backend/convex/lib/surveyAnalyticsReads.ts
```

Expected: no matches.

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
pnpm --filter @workspace/backend test -- queries.test.ts
```

Expected: FAIL because the new loaders do not exist.

- [ ] **Step 3: Implement shared context**

Resolve user/capability/scope once. Validate requested IDs against scope sets. Pass `nowMs` into `formatDateKey`; never call `Date.now()` inside query helpers.

- [ ] **Step 4: Implement bounded indexed loaders**

Use exact municipality reads for non-contiguous scopes and district indexes for complete district scopes. Every range ends in `.unique()` or a documented `.take()`:

```ts
await ctx.db
  .query("surveySurveyorStats")
  .withIndex("by_generation_and_municipalityId", (q) =>
    q.eq("generation", context.generation).eq("municipalityId", municipalityId),
  )
  .take(MAX_SURVEYORS_PER_MUNICIPALITY);
```

Set bounds so the aggregate across the accepted scope cannot exceed 5,000 surveyors. Throw a specific invariant error rather than silently slicing when the supported maximum is exceeded.

- [ ] **Step 5: Replace the old handler**

Keep the exported query declaration and validators. Delete:

- `loadBoundedSurveysForAnalytics`;
- post-read survey filtering;
- live grouping;
- QC-decision fan-out;
- repeated scope resolution;
- `rows.find()` municipality joins.

The handler should authenticate once and return `await loadStatsBreakdown(...)`.

- [ ] **Step 6: Verify shape and source-read removal**

Run:

```bash
pnpm --filter @workspace/backend test -- queries.test.ts
pnpm --filter @workspace/backend lint
pnpm --filter @workspace/backend typecheck
rg "loadBoundedSurveysForAnalytics|loadScopedQcDecisionsByReviewer" packages/backend/convex/analytics/queries.ts
```

Expected: tests/checks PASS; no use from `surveyStatsBreakdown`.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/convex/lib/surveyAnalyticsReads.ts packages/backend/convex/analytics/queries.ts packages/backend/convex/analytics/queries.test.ts
git commit -m "perf: make survey analytics aggregate-only"
```

---

### Task 7: Consolidate Dashboard Analytics into One Bundle

**Files:**

- Modify: `packages/backend/convex/analytics/queries.ts:1040-1215`
- Modify: `packages/backend/convex/analytics/queries.test.ts`
- Modify: `packages/backend/scripts/verify-convex-production-functions.mjs`

**Interfaces:**

- Produces:

```ts
dashboardBundle({
  nowMs: number,
  trendDays?: number,
}): {
  counts: Counts;
  analytics: AnalyticsBundle | null;
  qc: QcSupervisorBundle | null;
  recentActivity: RecentActivityRow[];
}
```

- Keeps `counts`, `analyticsBundle`, `qcSupervisorBundle`, `recentActivity`, and `homeBundle` as compatibility exports.

- [ ] **Step 1: Write failing bundle tests**

Assert:

- one auth/scope context is shared;
- counts equal the compatibility query;
- analytics and QC shapes equal compatibility queries;
- recent activity is ordered descending and bounded at 20;
- unauthorized/null behavior matches existing endpoints.

- [ ] **Step 2: Run and verify missing bundle**

Run:

```bash
pnpm --filter @workspace/backend test -- queries.test.ts
```

Expected: FAIL because `dashboardBundle` is not exported.

- [ ] **Step 3: Implement shared-context bundle**

Define explicit `args` and `returns` validators. Build one context, then run loaders concurrently:

```ts
const [counts, analytics, qc, recentActivity] = await Promise.all([
  loadCounts(ctx, context),
  loadAnalyticsBundle(ctx, context, days),
  loadQcSupervisorBreakdown(ctx, context),
  loadRecentActivity(ctx, context),
]);
return { counts, analytics, qc, recentActivity };
```

Compatibility queries invoke the same plain helpers, not `ctx.runQuery`.

- [ ] **Step 4: Remove duplicate sibling reads**

Ensure `analyticsBundle` no longer resolves scope inside `loadWardStatsForScope`, `loadSurveyorStatsForScope`, or `loadDashboardDailyTrend`. Delete old fan-out helpers when no callers remain.

- [ ] **Step 5: Update production function verification**

Add `analytics/queries.js:dashboardBundle` plus the active compatibility functions to `verify-convex-production-functions.mjs`.

- [ ] **Step 6: Run backend verification**

Run:

```bash
pnpm --filter @workspace/backend test -- queries.test.ts
pnpm --filter @workspace/backend lint
pnpm --filter @workspace/backend typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/convex/analytics/queries.ts packages/backend/convex/analytics/queries.test.ts packages/backend/scripts/verify-convex-production-functions.mjs
git commit -m "perf: consolidate dashboard analytics bundle"
```

---

### Task 8: Switch Dashboard Data Wiring to the Unified Bundle

**Files:**

- Modify: `apps/web/hooks/analytics/useAnalytics.ts`
- Modify: `apps/web/lib/convex-server.ts`
- Modify: `apps/web/app/(dashboard)/dashboard/dashboard-content.tsx`
- Modify: `apps/web/app/(dashboard)/dashboard/dashboard-home-client.tsx`
- Modify: `apps/web/app/(dashboard)/dashboard/dashboard-home-fallback.tsx`
- Modify: `apps/web/app/(dashboard)/dashboard/dashboard-activity-preloaded.tsx`

**Interfaces:**

- Consumes: `api.analytics.queries.dashboardBundle`.
- Preserves props consumed by `DashboardKpiGrid`, `DashboardQcOperations`, `DashboardAnalyticsClient`, and activity presentation.

- [ ] **Step 1: Add the unified hooks/preload**

Add:

```ts
export function useDashboardBundle(
  preloaded: Preloaded<typeof api.analytics.queries.dashboardBundle>,
) {
  return usePreloadedQuery(preloaded);
}
```

Add one server preload:

```ts
export const preloadDashboardBundle = cache(async (nowMs: number, trendDays = 30) =>
  preloadConvexQuery(api.analytics.queries.dashboardBundle, { nowMs, trendDays }),
);
```

- [ ] **Step 2: Replace four server preloads**

`DashboardContent` calls only `preloadDashboardBundle(nowMs)`. Preserve skippable error handling and client fallback. Pass the single preloaded value to `DashboardHomeClient`. Activity continues to use the same payload: change `DashboardActivityPreloaded` to accept `Preloaded<typeof api.analytics.queries.dashboardBundle>` and extract `recentActivity` via `useDashboardBundle`.

- [ ] **Step 3: Replace three fallback subscriptions**

Use one query:

```ts
const bundle = useQuery(
  api.analytics.queries.dashboardBundle,
  ready ? { nowMs, trendDays: 30 } : "skip",
);
```

Map `bundle?.counts`, `bundle?.analytics`, `bundle?.qc`, and `bundle?.recentActivity` to existing child props.

- [ ] **Step 4: Remove obsolete active wiring**

Keep deprecated exports only when other callers still exist. Use `rg` to prove whether they are safe to remove:

```bash
rg "preloadDashboard(Counts|Analytics|QcSupervisors|Activity)|useDashboard(Counts|Analytics|QcSupervisors)" apps/web
```

If only the new wiring remains, delete the unused preload/hook exports in the same commit.

- [ ] **Step 5: Run web checks**

Run:

```bash
pnpm --filter web lint
pnpm --filter web typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/hooks/analytics/useAnalytics.ts apps/web/lib/convex-server.ts "apps/web/app/(dashboard)/dashboard"
git commit -m "perf: load dashboard analytics in one request"
```

---

### Task 9: Performance, Contract, and Rollout Verification

**Files:**

- Modify: `packages/backend/convex/analytics/queries.test.ts`
- Modify: `packages/backend/convex/stats/internal.test.ts`
- Create: `packages/backend/scripts/benchmark-analytics.mjs`
- Modify: `packages/backend/package.json`
- Modify: `docs/superpowers/specs/2026-07-21-convex-analytics-refactor-design.md` only if measured results require correcting estimates.

**Interfaces:**

- Produces: repeatable fixture benchmark and final before/after report.

- [ ] **Step 1: Add production-like fixture generation**

Create deterministic fixtures for:

- 100 municipalities;
- 5,000 active surveyors;
- 180 daily rows per municipality;
- representative ward and QC reviewer rows.

The benchmark invokes `surveyStatsBreakdown` and `dashboardBundle` repeatedly after warm-up and records p50, p95, maximum, returned bytes, and logical range count.

- [ ] **Step 2: Add static hot-path gates**

The benchmark script fails if:

```text
surveyAnalyticsReads.ts contains query("surveys")
surveyAnalyticsReads.ts contains query("qcDecisions")
analytics query paths contain unbounded collect()
p95 >= 500 ms
response validation fails
```

Do not fail on a single maximum-latency outlier; report it separately.

- [ ] **Step 3: Run full local verification**

Run:

```bash
pnpm --filter @workspace/backend test
pnpm --filter @workspace/backend lint
pnpm --filter @workspace/backend typecheck
pnpm --filter web lint
pnpm --filter web typecheck
pnpm --filter @workspace/backend codegen
```

Expected: all PASS.

- [ ] **Step 4: Run development deployment verification**

Use development only:

```bash
pnpm --filter @workspace/backend dev --once
node packages/backend/scripts/benchmark-analytics.mjs
```

Expected:

- `surveyStatsBreakdown` p95 below 500 ms;
- `dashboardBundle` p95 below 500 ms;
- zero historical survey/QC-decision reads;
- unchanged public response validation;
- no isolate restart or total syscall-duration error.

- [ ] **Step 5: Validate migration workflow on development data**

Run the internal start function through the Convex development dashboard or CLI, rerun it with the same generation, and compare aggregate dumps. Activate only after validation reports both sources complete.

Expected: second run changes no counters and cutover is one metadata update.

- [ ] **Step 6: Record measured summary**

Add the measured values to the implementation handoff:

```text
Previous complexity:
New complexity:
Database ranges before:
Database ranges after:
p50/p95 before:
p50/p95 after:
Bytes read before:
Bytes read after:
Memory proxy reduction:
```

Never invent percentages; use benchmark and Convex insight values.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/scripts/benchmark-analytics.mjs packages/backend/package.json packages/backend/convex/analytics/queries.test.ts packages/backend/convex/stats/internal.test.ts pnpm-lock.yaml
git commit -m "test: enforce analytics performance budget"
```

---

## Production Rollout Checklist

- [ ] Deploy schema and dual-write code through the existing production deployment workflow only after all local gates pass.
- [ ] Start a new building generation with a unique immutable generation ID.
- [ ] Monitor mutation errors and OCC conflicts during temporary dual-write.
- [ ] Run survey and QC backfills to completion.
- [ ] Run generation validation and sample parity checks.
- [ ] Activate the generation atomically.
- [ ] Confirm dashboard and reports return unchanged response schemas.
- [ ] Confirm Convex logs contain no `queryStreamNext` timeout, total syscall-duration limit, or isolate restart.
- [ ] Confirm production p95 and bytes-read signals meet the target.
- [ ] Retain the previous generation during the observation window.
- [ ] Retire the previous generation through bounded scheduled batches.
