# Analytics and export pipeline redesign

**Date:** 2026-07-21  
**Status:** Approved design; awaiting specification review  
**Approach:** Approach 1 — finish generation cutover + queued file jobs  
**Scope:** Analytics + Excel export/import + bulk demand-notice PDF jobs (A+B)

## Summary

Make the production analytics and file-export system durable under self-hosted Convex load by:

1. Completing the generation-aware aggregate analytics cutover so historical KPIs never scan live `surveys` or `qcDecisions`.
2. Replacing browser SheetJS full-dataset materialization with queued, lease-based Excel jobs that stream rows with ExcelJS and store finished artifacts in Convex file storage.
3. Hardening bulk demand-notice PDF jobs with monotonic, attempt-scoped transitions, resume, and storage hygiene while keeping browser capture for layout fidelity.

This design extends and supersedes the analytics-only decisions in `2026-07-21-convex-analytics-refactor-design.md` for anything that conflicts. The earlier doc remains useful historical context for aggregate semantics.

## Decisions locked in design review

| Decision | Choice |
|---|---|
| Runtime boundary | Convex + existing web app only (no dedicated worker service) |
| Large export format | One multi-sheet `.xlsx` for all sizes |
| Export UX | Queued jobs for all Excel exports |
| Temp storage | Per-replica local persistent volume |
| Web topology | Multi-replica with distributed leases |
| Finished artifacts | Upload to Convex storage; download from any replica |
| Excel artifact retention | 24 hours |
| Analytics freshness | Transactional (same mutation as source write) |
| Excel import | Included; bounded resumable jobs |
| Demand-notice PDFs | Included; control-plane redesign only |
| Out of scope | Register full-scope print, CLI backup hardening, UI redesign, Redis/external workers |

## Honest SLO policy

Absolute guarantees such as “zero timeout anywhere” or “every query under 1 second forever” are not technically enforceable in a distributed self-hosted system. This redesign commits to measurable SLOs:

| Goal | Target |
|---|---|
| Dashboard analytics p95 | < 500 ms on production-like scale |
| Historical analytics source scans | Zero reads of `surveys` / `qcDecisions` |
| Silent truncation | Forbidden |
| Excel large export | Completes via queued job; download succeeds after `completed` |
| Isolate restarts from redesigned paths | None under load test for those paths |
| Work units | Bounded, retryable, observable |

## Current problems (audit)

### Analytics

- `surveyStatsBreakdown` still mixes rollups with live survey slices and raw QC decision fan-out.
- Silent caps (for example 2,000 surveys, 12 municipalities for active users, 200 decisions per ULB) produce incomplete reports without truncation metadata.
- Generation-aware tables and contribution ledgers exist, but `surveyAnalyticsMeta` has no lifecycle writers; readers stay on legacy indexes.
- Enabling non-legacy generations while legacy `.unique()` readers remain will match multiple rows and fail.
- Draft→draft dimension edits skip aggregate maintenance; legacy has no contribution reconciliation.
- Floor/photo/GPS/import completion paths can drift from completion aggregates.
- Excel import can catch aggregation errors after source writes, allowing drift to commit.
- Legacy backfill is additive and retry-unsafe.

### Excel export/import

- Browser accumulates all IDs and all enriched bundles, then SheetJS builds multiple full arrays and an in-memory workbook.
- `listExportIds` scans/sorts a bounded scope in one query; no true streaming.
- Nominal 1,500-row scope limit is silent and not a hard global limit under multi-ULB fan-out.
- QC Final Report UI assumes a different 5,000-row warning threshold.
- Enrichment fans out floors/photos/storage URLs per survey.
- Import is one mutation with serial row work; UI does not chunk large files; aggregation error catching breaks atomicity.

### Demand-notice PDFs

- Browser still materializes all payloads and the full PDF.
- Progress mutations can overwrite `completed` back to `rendering`.
- Concurrent completions and upload-then-fail paths can orphan storage blobs.
- Jobs are not attempt-scoped or cleanly resumable after refresh.

## Architecture

Three cooperating planes, no new services:

```text
┌─────────────────────────────────────────────────────────────┐
│ Web UI (existing buttons / panels)                          │
│  enqueue job → poll status → download when completed        │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
                ▼                             ▼
┌──────────────────────────────┐   ┌──────────────────────────┐
│ Convex job + analytics plane │   │ Web replica job runners  │
│ - aggregates + generations   │   │ - lease claim/heartbeat  │
│ - job docs, leases, audit    │   │ - ExcelJS stream writer  │
│ - upload URLs + storage IDs  │   │ - local temp volume      │
│ - retention crons            │   │ - PDF capture coordinator│
└──────────────────────────────┘   └──────────────────────────┘
```

1. **Analytics plane (Convex):** transactional aggregate tables; generation metadata; aggregate-only reads.
2. **Job plane (Convex + web replicas):** durable job documents; distributed leases; bounded runners.
3. **Artifact plane:** local temp for streaming generation; Convex storage for finished downloadable files.

## Analytics plane

### Aggregate ownership

Keep and repair:

- `surveyMunicipalityStats`
- `surveyDailyStats`
- `surveyWardStats`
- `surveySurveyorStats`

Activate for readers:

- `surveyDistrictStats`
- `surveyQcReviewerStats`
- `surveyAnalyticsContributions`
- `qcAnalyticsContributions`
- `surveyAnalyticsMeta`

### Canonical counter semantics

- Current-state counters: `total`, `drafts`, `submitted`, `approved`, `rejected`, `pending` are not mutually exclusive; consumers must not infer `total` by summing status/QC fields.
- Daily `created` counts creation events.
- Daily `submitted` counts submission events and is not removed by later approval, rejection, or reopen.
- Daily `approved` / `rejected` count QC decision events.
- All daily keys use Asia/Kolkata boundaries.
- QC supervisor throughput comes from `surveyQcReviewerStats`, not raw decision documents.
- One survey contribution stores at most one `submittedAt` for daily movement; repeated submit cycles move the previous daily submission event rather than inventing multiple lifetime submissions from a single field. If product later needs every attempt counted, add an append-only submission-event ledger in a follow-on design.

### Write path

Focused helpers (names may match existing modules):

- `applySurveyStatsInsert`
- `applySurveyStatsUpdate`
- `applySurveyStatsRemove`
- `applyQcDecisionStats`
- `applySurveyorReassignmentStats`
- `applyCompletionStats`

Rules:

- Compute before/after once; update every affected dimension in the same mutation; await all promises.
- Cover survey draft/upsert/submit/delete, QC decide/reopen, import upsert, reassignment, and completion-affecting floor/photo/GPS/progress writes.
- Draft→draft dimension moves must maintain aggregates (no skip).
- Import must not catch aggregation failures after a successful source write; each survey row is atomic (source + aggregates) or neither commits.
- Counter helpers validate invariants; impossible next values fail the transaction.

### Shared read context

`loadAnalyticsContext(ctx, filters?)` authenticates once, checks `analytics.view`, resolves tenant scope once, validates filters once, computes Asia/Kolkata date key from caller `nowMs`, and returns immutable scope maps. All loaders reuse this context.

### Optimized reads

Public contracts remain unchanged for:

- `surveyStatsBreakdown`
- `counts`
- `dailyTrend`
- `wardCoverage`
- `analyticsBundle`
- `qcSupervisorBundle`
- `recentActivity`
- `homeBundle` (compatibility wrapper)

Handlers become thin orchestration over indexed aggregate loaders. They never read `surveys` or `qcDecisions` for historical KPIs and never use live-data fallback. `recentActivity` remains a separate bounded indexed raw query (≤20).

Add `dashboardBundle({ nowMs, trendDays? })` that authenticates once and runs independent aggregate loaders concurrently. Dashboard wiring may switch to this endpoint while keeping existing endpoints available.

### Generation cutover

1. Fix legacy indexes / readers so generations cannot collide on `.unique()` before any building generation is populated.
2. Dual-write active and building generations.
3. Cursor-based, self-scheduling internal backfill using contribution comparison (zero delta on retry).
4. Persist cursors in `surveyAnalyticsMeta`, not only scheduler args.
5. Validate aggregate totals and representative breakdowns against source data.
6. Set readiness only after full generation validation.
7. Atomically switch readers to the ready generation.
8. Remove live KPI fallbacks and silent truncation caps.
9. Switch dashboard wiring to `dashboardBundle` where appropriate.
10. Retire the old generation in bounded batches after an observation period.

Readers never expose a partially rebuilt generation.

### Expected impact

- Before: multi-second to 15s+ query streams, large survey/decision payloads, silent incompleteness.
- After: small aggregate documents only; p95 target < 500 ms; no historical source-table scans.

## Excel export and import jobs

### Export lifecycle

1. UI calls `startSurveyExcelExport(filters)` (and equivalent for QC Final Report) → queued job with auth snapshot, filters, attempt 0.
2. A web replica claims the job with lease fields: `ownerReplicaId`, `leaseExpiresAt`, heartbeat.
3. Runner pages Convex data with cursor pagination — never one full-scope ID array query for unbounded scopes.
4. ExcelJS `stream.xlsx.WorkbookWriter` writes to a local temp file; every row is committed.
5. On success: finalize temp → Convex `generateUploadUrl` → POST file → store `storageId` → status `completed`.
6. UI polls and downloads when ready.
7. Retention deletes Excel artifacts after 24 hours.

Workbook compatibility:

- Sheets: `Surveys`, `CoOwners`, `Floors`, `Photos`, `Guide`
- Stable headers for re-import
- Photo cells remain URL metadata (not embedded binaries)

Completeness rules:

- No silent 1,500-row success truncation.
- Progress reports `{ processed, totalEstimate?, complete }`.
- Hard infra limits yield typed `failed`, never partial success.
- Mid-export deletes are recorded as skipped; creates after job start are out of scope for that job’s completeness claim.
- Expired leases: another replica reclaims and restarts from a safe checkpoint (rebuild workbook from cursor; never append to a dead replica’s half-written local file).

Concurrency:

- Global and per-user job caps.
- Compare-and-set lease claim/heartbeat.

### Import lifecycle

1. Client uploads the workbook to Convex storage and creates an import job referencing that `storageId`.
2. A web replica claims the job, downloads the workbook, and parses sheets (same sheet/header aliases as today).
3. The runner applies surveys in bounded batches via Convex mutations (≤ current `MAX_IMPORT_SURVEYS` per mutation), advancing a durable cursor on the job.
4. Each survey row is atomic: source + analytics transition succeed together.
5. Floors attach by Property ID as today.
6. Job accumulates `{ created, updated, errors[] }` and resumes from the last successful cursor after lease reclaim.

### Compatibility wrappers

Keep available during migration:

- `export.queries.listExportIds`
- `export.queries.getExportBundlesByIds`
- `export.queries.listForExport`
- `export.mutations.importExcelBundle`

UI switches to job APIs. Legacy endpoints are deprecated but not removed in this initiative.

QC Final Report Excel uses the same job infrastructure with its existing sheet/filename contract.

## Bulk demand-notice PDF jobs

Browser capture remains for official A4 layout fidelity. This initiative redesigns the control plane only.

### Monotonic state machine

Allowed transitions:

`queued → rendering → uploading → completed`  
any in-flight → `failed`  
`completed` and `failed` are terminal.

Rules:

- Progress updates cannot write `rendering` over `uploading` / `completed` / `failed`.
- Every transition carries `attempt` and compare-and-set on current status.
- Late fire-and-forget progress/fail mutations are ignored when attempt/status mismatch.
- `completeExport` is idempotent for the same `storageId`; concurrent completions clean up the losing blob.

### Resume

- Job document is source of truth.
- Client reload resumes from `processedCount` / next payload offset for the same user/attempt.
- Payload page size remains 25; existing 200-notice hard cap remains unless raised in a separate capacity decision.

### Storage hygiene

- Upload then failed complete: retention/reaper deletes unreferenced blobs after a short grace window, or retry replaces/reuses storage IDs.
- Demand-notice PDF retention may remain ~7 days completed / ~3 days failed (existing policy), distinct from Excel’s 24-hour retention.

### Non-goals for PDF

- No server-side HTML→PDF rewrite.
- No automatic increase of the 200-notice cap.
- Single-notice print path unchanged.

## Error handling and security

- Validate args, IDs, dates, filters, and nullability on every public function.
- Structured errors: `FORBIDDEN`, `VALIDATION`, `NOT_FOUND`, `CONFLICT`, `FAILED`.
- No unhandled promise rejections; runners always release leases and clean temp files.
- `Promise.all` only for independent bounded work where total failure is correct; partial product success (import row errors) uses explicit per-row handling, not silent swallow of aggregate failures.
- Job create/claim/download require existing capabilities (`reports.export`, `analytics.view`, demand-notice access).
- Re-validate tenant scope at claim time, not only at enqueue.
- Download gated by ownership/capability before returning storage URLs.
- No client-trusted user IDs for scope.

## Observability

Structured logs for:

- slow analytics paths
- lease claim/reclaim
- backfill cursor progress
- generation readiness/cutover
- job failures and retention deletions

Post-rollout gate: no timeout / excessive-read findings for redesigned analytics/export paths under production-like load.

## Testing and verification

Convex / unit tests:

- insert, update, submit, approve, reject, reopen, reassign, delete, import transitions
- completion percentage changes from floors/photos/GPS/progress
- Asia/Kolkata date boundaries
- daily event semantics after later state transitions
- idempotent backfill retries during concurrent live writes
- generation readiness and atomic cutover
- tenant/district/municipality/surveyor filters
- scopes of 100 municipalities and 5,000 surveyors without truncation
- Excel job lease reclaim, failure, retention, workbook header compatibility
- demand-notice monotonic transitions, late-progress ignore, orphan cleanup, resume

Verification gates:

- no historical analytics loader reads `surveys` or `qcDecisions`
- no unbounded `.collect()` on growing tables in redesigned paths
- every database range indexed and bounded
- dashboard metrics available through one public bundle without changing component props
- ESLint, typecheck, Convex tests, and affected web tests pass

## Deployment notes (self-hosted)

- Web replicas need a mounted local persistent path for temp Excel files (for example `EXPORT_TEMP_DIR`).
- Leases must work without a shared filesystem.
- Finished files live in Convex storage so any replica can serve downloads.
- Tune web process memory for concurrent ExcelJS writers according to global job caps.
- Do not rely on raising Convex action timeouts to fix query/mutation scan timeouts; remove the scans instead.
- Keep `ACTIONS_USER_TIMEOUT_SECS` set to a non-empty integer in Dokploy env (existing ops requirement).

## Non-goals

- Dedicated export worker microservice
- Shared NFS/volume across web replicas
- CSV/ZIP as the primary large-export format
- Embedding photo binaries in Excel
- UI redesign or component prop redesign
- Register full-scope print
- CLI/dashboard Convex backup hardening
- Redis or external cache
- Generic duplicate aggregate tables beyond the generation-aware model already started

## Relationship to prior docs

- Supersedes conflicting guidance in `2026-07-21-convex-analytics-refactor-design.md` for cutover safety, import atomicity, completion writes, and reader behavior.
- Preserves that document’s counter semantics and aggregate table inventory unless this document explicitly changes them.
- Export/PDF job design is new relative to the analytics-only spec.

## Implementation order (high level)

1. Analytics index/reader safety fixes that unblock generation coexistence.
2. Write-path completeness (draft moves, completion, import atomicity).
3. Generation lifecycle + idempotent backfill + validation + cutover.
4. Aggregate-only analytics readers + dashboard bundle wiring.
5. Excel export job schema, leases, runner, UI queue UX, retention.
6. Excel import job chunking and atomic row writes.
7. Demand-notice PDF monotonic transitions, resume, storage hygiene.
8. Load tests and cutover observation; deprecate legacy browser Excel paths in UI only after job path is stable.
