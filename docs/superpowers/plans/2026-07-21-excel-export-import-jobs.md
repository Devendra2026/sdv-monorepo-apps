# Excel Export / Import Jobs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace browser SheetJS full-dataset Excel export/import with durable queued jobs that stream XLSX via ExcelJS on web replicas and store finished files in Convex storage so downloads always succeed after `completed`.

**Architecture:** Convex owns job documents, leases, auth snapshots, progress, and storage IDs. Each Next.js web replica runs a Node job runner (instrumentation + tick) that claims leases, pages survey data with cursor queries, writes committed ExcelJS rows to a local temp file, uploads the finished workbook through a Convex upload URL, and marks the job complete. Import jobs download the uploaded workbook, parse sheets, and apply atomic per-survey mutations with durable cursors.

**Tech Stack:** Convex 1.42, TypeScript strict, Next.js 16 (`next start` Node), ExcelJS streaming writer, Vitest, pnpm.

## Global Constraints

- Runtime: Convex + existing web app only (no dedicated worker microservice).
- Format: one multi-sheet `.xlsx` (Surveys, CoOwners, Floors, Photos, Guide).
- UX: queued jobs for all Excel exports; poll then download.
- Temp files: per-replica local volume (`EXPORT_TEMP_DIR`).
- Finished artifacts: Convex file storage; any replica can serve download URLs.
- Retention: delete completed Excel artifacts after 24 hours.
- Multi-replica: distributed leases with compare-and-set; reclaim rebuilds workbook from cursor.
- No silent truncation; hard failures use typed `failed` status.
- Keep legacy `listExportIds` / `getExportBundlesByIds` / `listForExport` / `importExcelBundle` available but deprecated.
- Preserve workbook headers/aliases used by import.
- Cap concurrent Excel jobs globally and per user (defaults: 2 global, 1 per user).

---

## File Structure

### New backend files

- `packages/backend/convex/exportJobs/schemaHelpers.ts` — shared validators/status unions (if needed) or keep validators inline.
- `packages/backend/convex/exportJobs/mutations.ts` — start/claim/heartbeat/progress/complete/fail/import chunk APIs.
- `packages/backend/convex/exportJobs/queries.ts` — getJob, listMine, nextExportPage.
- `packages/backend/convex/exportJobs/internal.ts` — retention purge for excel jobs.
- `packages/backend/convex/lib/exportJobState.ts` — pure status transition helpers.
- `packages/backend/convex/lib/exportJobState.test.ts` — transition tests.

### Existing backend files

- `packages/backend/convex/schema.ts` — add `surveyExcelJobs` (+ optional `surveyExcelImportJobs` or unified table).
- `packages/backend/convex/crons.ts` — schedule excel retention.
- `packages/backend/convex/retention.ts` — call excel purge or keep purge in `exportJobs/internal.ts`.
- `packages/backend/convex/export/queries.ts` — keep legacy; add thin deprecation comments.
- `packages/backend/convex/export/mutations.ts` — keep `importExcelBundle` for chunk application; fix atomicity (no catch after successful patch + failed rollup).
- `packages/backend/convex/lib/budgetLimits.ts` — export page sizes for job runner pages (keep 40 enrichment page).

### New web files

- `apps/web/lib/export-jobs/types.ts` — job DTOs.
- `apps/web/lib/export-jobs/exceljs-writer.ts` — streaming workbook writer (committed rows).
- `apps/web/lib/export-jobs/runner.ts` — claim loop, heartbeat, export/import processors.
- `apps/web/lib/export-jobs/runner.test.ts` — pure helpers (path naming, checkpoint restart).
- `apps/web/instrumentation.ts` — start runner once on Node server boot.
- `apps/web/app/api/internal/export-jobs/tick/route.ts` — optional authenticated tick endpoint for ops/cron.
- `apps/web/hooks/export/useSurveyExcelJob.ts` — start + poll + download.
- `apps/web/hooks/export/useSurveyExcelImportJob.ts` — upload + poll.

### Existing web files

- `apps/web/components/surveys/survey-excel-actions.tsx` — switch to job hooks.
- `apps/web/components/reports/qc-final-report-panel/qc-final-report-export-button.tsx` — switch to job hooks (kind=`qc_final`).
- `apps/web/package.json` — add `exceljs`.
- `apps/web/.env.example` — `EXPORT_TEMP_DIR`, `EXPORT_WORKER_ENABLED`, `EXPORT_WORKER_SECRET`.
- `railpack.json` / deploy docs — mount persistent temp path if required by host.

---

### Task 1: Pure job state machine

**Files:**
- Create: `packages/backend/convex/lib/exportJobState.ts`
- Create: `packages/backend/convex/lib/exportJobState.test.ts`

**Interfaces:**
- Produces: `ExcelJobStatus`, `canTransitionExcelJob(from, to)`, `assertExcelJobTransition(from, to)`, `EXCEL_JOB_TERMINAL`
- Consumes: none

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest"
import { assertExcelJobTransition, canTransitionExcelJob } from "./exportJobState"

describe("excel job transitions", () => {
  it("allows queued -> running -> uploading -> completed", () => {
    expect(canTransitionExcelJob("queued", "running")).toBe(true)
    expect(canTransitionExcelJob("running", "uploading")).toBe(true)
    expect(canTransitionExcelJob("uploading", "completed")).toBe(true)
  })

  it("rejects completed -> running", () => {
    expect(canTransitionExcelJob("completed", "running")).toBe(false)
    expect(() => assertExcelJobTransition("completed", "running")).toThrow(/transition/i)
  })

  it("allows any in-flight -> failed", () => {
    for (const from of ["queued", "running", "uploading"] as const) {
      expect(canTransitionExcelJob(from, "failed")).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run test — expect FAIL (module missing)**

Run: `pnpm --filter @workspace/backend test -- convex/lib/exportJobState.test.ts`

- [ ] **Step 3: Implement**

```ts
export type ExcelJobStatus = "queued" | "running" | "uploading" | "completed" | "failed"

const ALLOWED: Record<ExcelJobStatus, readonly ExcelJobStatus[]> = {
  queued: ["running", "failed"],
  running: ["uploading", "failed"],
  uploading: ["completed", "failed"],
  completed: [],
  failed: [],
}

export function canTransitionExcelJob(from: ExcelJobStatus, to: ExcelJobStatus): boolean {
  return ALLOWED[from].includes(to)
}

export function assertExcelJobTransition(from: ExcelJobStatus, to: ExcelJobStatus): void {
  if (!canTransitionExcelJob(from, to)) {
    throw new Error(`Invalid excel job transition ${from} -> ${to}`)
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/backend/convex/lib/exportJobState.ts packages/backend/convex/lib/exportJobState.test.ts
git commit -m "test: define excel export job state transitions"
```

---

### Task 2: Schema for surveyExcelJobs

**Files:**
- Modify: `packages/backend/convex/schema.ts` (append before final `})`)

**Interfaces:**
- Produces: table `surveyExcelJobs` with indexes `by_status_created`, `by_user_created`, `by_leaseExpiresAt`, `by_createdAt`

- [ ] **Step 1: Add table**

```ts
surveyExcelJobs: defineTable({
  kind: v.union(v.literal("survey_full"), v.literal("qc_final"), v.literal("survey_import")),
  requestedBy: v.id("users"),
  status: v.union(
    v.literal("queued"),
    v.literal("running"),
    v.literal("uploading"),
    v.literal("completed"),
    v.literal("failed"),
  ),
  attempt: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
  filters: v.object({
    status: v.optional(surveyStatus),
    qcStatus: v.optional(qcStatus),
    wardNo: v.optional(v.string()),
    districtId: v.optional(v.id("districts")),
    municipalityId: v.optional(v.id("municipalities")),
    surveyorId: v.optional(v.id("users")),
  }),
  asOfMs: v.number(),
  cursor: v.optional(v.string()),
  processedCount: v.number(),
  skippedCount: v.number(),
  totalEstimate: v.optional(v.number()),
  filename: v.optional(v.string()),
  storageId: v.optional(v.id("_storage")),
  sourceStorageId: v.optional(v.id("_storage")), // import workbook
  errorMessage: v.optional(v.string()),
  ownerReplicaId: v.optional(v.string()),
  leaseExpiresAt: v.optional(v.number()),
  importCreated: v.optional(v.number()),
  importUpdated: v.optional(v.number()),
  importErrorCount: v.optional(v.number()),
})
  .index("by_status_created", ["status", "createdAt"])
  .index("by_user_created", ["requestedBy", "createdAt"])
  .index("by_leaseExpiresAt", ["leaseExpiresAt"])
  .index("by_createdAt", ["createdAt"]),
```

- [ ] **Step 2: Run codegen / typecheck**

Run: `pnpm --filter @workspace/backend exec convex codegen` (or ensure `convex dev` refreshes) then `pnpm --filter @workspace/backend typecheck`

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/backend/convex/schema.ts packages/backend/convex/_generated
git commit -m "feat: add surveyExcelJobs schema for queued exports"
```

---

### Task 3: Job mutations and queries

**Files:**
- Create: `packages/backend/convex/exportJobs/mutations.ts`
- Create: `packages/backend/convex/exportJobs/queries.ts`
- Modify: `packages/backend/convex/lib/budgetLimits.ts` — add `MAX_EXCEL_JOBS_GLOBAL = 2`, `MAX_EXCEL_JOBS_PER_USER = 1`, `EXCEL_JOB_LEASE_MS = 60_000`, `EXCEL_EXPORT_PAGE_SIZE = 40`

**Interfaces:**
- Produces:
  - `startExport({ kind, filters }) -> Id<"surveyExcelJobs">`
  - `generateUploadUrlForImport() -> string`
  - `startImport({ sourceStorageId }) -> Id<"surveyExcelJobs">`
  - `claimNext({ replicaId, nowMs }) -> job | null`
  - `heartbeat({ jobId, attempt, replicaId, nowMs }) -> null`
  - `reportProgress({ jobId, attempt, cursor, processedCount, skippedCount, totalEstimate? }) -> null`
  - `markUploading({ jobId, attempt }) -> null`
  - `completeExport({ jobId, attempt, storageId, filename }) -> null`
  - `failJob({ jobId, attempt, errorMessage }) -> null`
  - `getJob({ jobId }) -> { status, progress, downloadUrl|null, errorMessage|null, ... }`
  - `nextExportPage({ jobId, paginationOpts }) -> { page: Doc<"surveys">[], isDone, continueCursor }` (auth + scope from job)

- [ ] **Step 1: Write convex-test for start + illegal transition**

Create `packages/backend/convex/exportJobs/exportJobs.test.ts` that:
1. Seeds a user with `reports.export`
2. Calls `startExport`
3. Completes via internal helper path or mutation sequence
4. Asserts `failJob` after `completed` throws or no-ops with CONFLICT

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement mutations/queries**

Key rules in handlers:
- `requireUser` + `reports.export` (or `analytics.view` only if already required for QC final — keep same capability as current UI callers: `reports.export` for survey excel; QC final uses same export queries today).
- Enforce per-user/global queued+running caps.
- `claimNext`: status `queued` OR (`running`/`uploading` with `leaseExpiresAt < nowMs`); CAS set `ownerReplicaId`, `leaseExpiresAt = nowMs + EXCEL_JOB_LEASE_MS`, increment attempt only on reclaim from expired lease (reset cursor/processed for export rebuild).
- All status writes call `assertExcelJobTransition` and require matching `attempt`.
- `getJob` returns storage URL only when `completed` and caller is owner or admin with capability.
- `nextExportPage`: load job, re-validate tenant scope for `requestedBy`, paginate with indexed survey queries — **never** call `collectSurveysForListPaginated` for the full scope. Prefer municipality-scoped `paginate` with filters applied in TypeScript for small pages.

- [ ] **Step 4: Tests PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/backend/convex/exportJobs packages/backend/convex/lib/budgetLimits.ts
git commit -m "feat: add survey excel job claim and progress APIs"
```

---

### Task 4: Cursor export page without full-scope collect

**Files:**
- Modify: `packages/backend/convex/exportJobs/queries.ts` (`nextExportPage`)
- Optionally create: `packages/backend/convex/lib/exportSurveyPage.ts`
- Test: `packages/backend/convex/exportJobs/exportPage.test.ts`

**Interfaces:**
- Produces: `loadExportSurveyPage(ctx, filters, scope, paginationOpts) -> PaginationResult<Doc<"surveys">>`
- Must not use `EXPORT_SCOPE_LIMIT` silent truncation.

- [ ] **Step 1: Failing test** — seed >50 surveys across 2 municipalities; paginate with `numItems: 40` twice; assert all IDs unique and eventually `isDone`.

- [ ] **Step 2: Implement indexed pagination**

Implementation sketch:
- If `municipalityId` filter: `by_municipality` (+ status/qc filters in TS).
- Else if `districtId`: page municipalities in district, then page surveys per municipality (store compound cursor JSON: `{ muniIndex, surveyCursor }`).
- Else: page all scoped municipalities the same way.
- Sort within page by `propertyId` only for stable sheet order within page; global strict propertyId sort across municipalities is best-effort unless a dedicated sort index exists — document this in a code comment as intentional for streaming exports.

- [ ] **Step 3: Enrichment stays in runner** — page returns survey docs only; floors/photos loaded per page in the web runner via a bounded query `getExportBundlesByIds` (legacy) or new `enrichExportPage({ surveyIds })` capped at 40.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: paginate excel export surveys without full-scope collect"
```

---

### Task 5: Fix importExcelBundle atomicity

**Files:**
- Modify: `packages/backend/convex/export/mutations.ts`
- Test: extend or add `packages/backend/convex/export/importAtomicity.test.ts`

**Interfaces:**
- Consumes: `recordSurveyStatsInsert` / `recordSurveyStatsUpdate`
- Produces: unchanged `{ created, updated, errors[] }`

- [ ] **Step 1: Write failing test** — mock/spy path where stats update throws; assert survey patch is not committed (whole row fails into `errors` without leaving drift). In convex-test, force stats helper to throw and assert no survey row for that localId.

- [ ] **Step 2: Restructure loop**

```ts
for (const row of args.surveys) {
  try {
    // all reads + patch/insert + recordSurveyStats* inside this try
    // if stats throws, rethrow so Convex rolls back this mutation
    // BUT we need per-row atomicity across a multi-row mutation...
  }
}
```

Important Convex reality: one mutation is one transaction. Per-row atomicity for a multi-row import requires **one mutation per survey row** (or accept whole-batch rollback). Spec requires per-survey atomicity → change job runner to call `importExcelBundle` with **one survey (and its floors) per mutation**, or add `importExcelSurveyRow` mutation.

- [ ] **Step 3: Add `importExcelSurveyRow` mutation** (preferred)

```ts
export const importExcelSurveyRow = mutation({
  args: { survey: importSurveyRow, floors: v.optional(v.array(importFloorRow)) },
  returns: v.union(
    v.object({ outcome: v.literal("created"), surveyId: v.id("surveys") }),
    v.object({ outcome: v.literal("updated"), surveyId: v.id("surveys") }),
  ),
  handler: async (ctx, args) => {
    // no broad catch; validation errors throw clientError
    // stats update in same transaction
  },
})
```

Keep `importExcelBundle` as a thin loop calling shared helper **without** swallowing stats errors mid-row; deprecate multi-row for job path.

- [ ] **Step 4: Commit**

```bash
git commit -m "fix: make excel import survey rows transactionally atomic"
```

---

### Task 6: Retention for excel jobs (24h)

**Files:**
- Create: `packages/backend/convex/exportJobs/internal.ts`
- Modify: `packages/backend/convex/crons.ts`
- Modify: `packages/backend/convex/retention.ts` OR schedule `exportJobs.internal.purgeExpiredExcelJobs` from crons

- [ ] **Step 1: Implement purge**

```ts
const EXCEL_RETENTION_MS = 24 * 60 * 60 * 1000
// paginate by_createdAt, delete completed/failed older than retention,
// delete storageId + sourceStorageId, chain scheduler
```

Also delete orphaned in-flight jobs older than 24h (same as completed policy for excel).

- [ ] **Step 2: Wire cron** (extend existing 6h sweep or add interval)

- [ ] **Step 3: Commit**

```bash
git commit -m "feat: retain survey excel job artifacts for 24 hours"
```

---

### Task 7: ExcelJS streaming writer on web

**Files:**
- Modify: `apps/web/package.json` — dependency `exceljs`
- Create: `apps/web/lib/export-jobs/exceljs-writer.ts`
- Create: `apps/web/lib/export-jobs/exceljs-writer.test.ts`

**Interfaces:**
- Produces: `createSurveyExcelWriter(filePath): { addBundle(bundle), finalize(): Promise<void> }`
- Sheets/headers must match `apps/web/lib/survey/survey-excel.ts` column names used by import.

- [ ] **Step 1: Install**

```bash
pnpm add --filter web exceljs
pnpm add -D --filter web @types/exceljs
```

- [ ] **Step 2: Failing test** — write 2 fake bundles to a temp file; read back with ExcelJS/xlsx; assert sheet names and Property ID cells.

- [ ] **Step 3: Implement with WorkbookWriter**

```ts
import ExcelJS from "exceljs"
import fs from "node:fs"

export async function createSurveyExcelWriter(filePath: string) {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    filename: filePath,
    useStyles: false,
    useSharedStrings: false,
  })
  const surveys = workbook.addWorksheet("Surveys")
  // set columns to match surveyMainRow keys
  // similarly CoOwners, Floors, Photos, Guide
  return {
    async addBundle(bundle: SurveyExportBundle) {
      surveys.addRow(surveyMainRow(bundle)).commit()
      for (const row of coOwnerRows(bundle)) coOwners.addRow(row).commit()
      // floors, photos...
    },
    async finalize() {
      await surveys.commit()
      // commit other sheets
      await workbook.commit()
    },
  }
}
```

Reuse row-mapping functions by exporting them from `survey-excel.ts` or duplicating carefully with a shared module `apps/web/lib/survey/survey-excel-rows.ts`.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add streaming ExcelJS survey workbook writer"
```

---

### Task 8: Web job runner

**Files:**
- Create: `apps/web/lib/export-jobs/runner.ts`
- Create: `apps/web/lib/export-jobs/config.ts`
- Create: `apps/web/instrumentation.ts` (or extend if exists)
- Create: `apps/web/app/api/internal/export-jobs/tick/route.ts`

**Interfaces:**
- Produces: `startExportJobRunner()`, `tickExportJobsOnce()`
- Env: `EXPORT_WORKER_ENABLED=1`, `EXPORT_TEMP_DIR`, `EXPORT_REPLICA_ID`, `EXPORT_WORKER_SECRET`, `NEXT_PUBLIC_CONVEX_URL`, server Convex deploy key or user-less worker auth via Convex HTTP?  

**Auth reality:** Convex mutations require a user JWT. Runner cannot use anonymous client for user jobs.

**Required approach:**
1. `claimNext` / progress / complete are **`internalMutation`s** invoked from a Convex **action** scheduled by the job, **or**
2. Prefer: web runner authenticates as the **requesting user** — not possible without storing tokens.

**Correct Convex pattern for this stack:**
- Add `internal.exportJobs.claimNext` etc.
- Web route uses Convex HTTP admin / deploy key **only if** self-hosted admin actions allow it — avoid.
- Better: **the browser that starts the job also drives processing** via a worker tab loop is unreliable.

**Chosen design (compatible with Convex auth):**
1. `startExport` schedules `internal.exportJobs.runExportBatch` via `ctx.scheduler.runAfter(0, ...)` chaining batches entirely **inside Convex Node actions** writing to storage.

Conflict: user forbade dedicated worker but Convex Node actions can write files to `/tmp` and upload to storage — that stays inside Convex + web UI for download. Spec said web replicas + local volume because Convex actions may lack large disk.

Self-hosted Convex actions have filesystem in the action isolate — often limited. Spec explicitly chose web replicas + local volume.

**Auth bridge for web runner:**
- Store on job a one-time `workerToken` (random 32 bytes) at start; hash in DB.
- Public HTTP action or Next route presents `jobId + workerToken` to Convex mutations `claimWithToken` that validate the token hash and proceed without end-user JWT.
- Browser keeps the token only if client-driven; for server runner, token is written only to Convex and the Next server reads claimable jobs via a **Convex internal HTTP webhook** authenticated with `EXPORT_WORKER_SECRET` that runs as an HTTP action calling internal mutations.

Implement:

1. `convex/http.ts` — `POST /export-jobs/worker` with header `Authorization: Bearer ${EXPORT_WORKER_SECRET}` matching Convex env `EXPORT_WORKER_SECRET`.
2. HTTP action calls `internal.exportJobs.claimNext`, returns job payload.
3. Web runner calls that HTTP endpoint (site origin), processes, posts progress to sibling HTTP routes.

- [ ] **Step 1: Add HTTP worker endpoints + internal mutations**

- [ ] **Step 2: Implement `tickExportJobsOnce` in Next** calling those endpoints, writing temp XLSX, uploading via generateUploadUrl internal path.

- [ ] **Step 3: Start interval from `instrumentation.ts` when `EXPORT_WORKER_ENABLED=1`**

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.EXPORT_WORKER_ENABLED === "1") {
    const { startExportJobRunner } = await import("./lib/export-jobs/runner")
    startExportJobRunner()
  }
}
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: run leased excel export jobs on web replicas"
```

---

### Task 9: UI — queued export / import

**Files:**
- Create: `apps/web/hooks/export/useSurveyExcelJob.ts`
- Modify: `apps/web/components/surveys/survey-excel-actions.tsx`
- Modify: `apps/web/components/reports/qc-final-report-panel/qc-final-report-export-button.tsx`

- [ ] **Step 1: Hook starts job and polls `getJob` every 1s**

```ts
toast.loading("Queued Excel export…")
// on completed: window.location.href = downloadUrl OR fetch blob
// on failed: toast.error(errorMessage)
```

- [ ] **Step 2: Import flow** — `generateUploadUrl` → POST file → `startImport` → poll.

- [ ] **Step 3: Remove client-side `allBundles` accumulation path from these buttons.**

- [ ] **Step 4: Manual QA checklist in commit body**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: queue excel export and import from survey UI"
```

---

### Task 10: QC Final Report job kind

**Files:**
- Extend writer to support `qc_final` single-sheet output using existing `bundlesToQcFinalReportRows` logic on the runner (fetch tax rates per municipality once, cache in Map).
- Wire export button to `kind: "qc_final"`.

- [ ] **Steps:** failing test for sheet name `QC Final Report` → implement → commit

```bash
git commit -m "feat: queue QC final report excel exports"
```

---

### Task 11: Verification

- [ ] **Step 1:** `pnpm --filter @workspace/backend test`
- [ ] **Step 2:** `pnpm --filter @workspace/backend lint`
- [ ] **Step 3:** `pnpm --filter web test`
- [ ] **Step 4:** `pnpm --filter web typecheck`
- [ ] **Step 5:** Manual: export >1 page of surveys on staging; confirm download opens in Excel; confirm second replica can download; confirm 24h retention path dry-run.
- [ ] **Step 6:** Commit any fixes

---

## Self-review vs spec

| Spec requirement | Task |
|---|---|
| Queued Excel UX | Task 9 |
| ExcelJS streaming + row commit | Task 7–8 |
| Local temp + Convex storage upload | Task 8 |
| Multi-replica leases | Task 3, 8 |
| No silent 1500 truncation | Task 4 |
| Import atomic + resumable | Task 5, 8–9 |
| 24h retention | Task 6 |
| Legacy APIs kept | Task 3 (no deletions) |
| QC final excel | Task 10 |
| Worker auth without end-user JWT on server | Task 8 HTTP secret bridge |
