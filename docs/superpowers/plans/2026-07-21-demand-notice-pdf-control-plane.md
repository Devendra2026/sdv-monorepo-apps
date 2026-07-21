# Demand-Notice PDF Control Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make bulk demand-notice PDF jobs monotonic, attempt-scoped, resumable after refresh, and free of progress/complete races that orphan storage blobs — without rewriting browser HTML→PDF capture.

**Architecture:** Keep client `html2canvas` + `jsPDF` capture. Add pure transition helpers and compare-and-set mutations on `demandNoticeExportJobs` with `attempt`. Client resumes from `processedCount`. Retention sweeps unreferenced uploads after a grace window.

**Tech Stack:** Convex 1.42, TypeScript, Vitest, existing web capture hooks.

## Global Constraints

- Browser capture retained for A4 layout fidelity.
- Soft cap remains 200 notices unless a separate capacity decision raises it.
- Completed PDF retention ~7 days; failed ~3 days (existing).
- No silent status regressions (`completed` must never become `rendering`).

---

## File Structure

- Create: `packages/backend/convex/lib/demandNoticeJobState.ts`
- Create: `packages/backend/convex/lib/demandNoticeJobState.test.ts`
- Modify: `packages/backend/convex/schema.ts` — add `attempt: v.number()` on `demandNoticeExportJobs` (default 0 for new jobs; patch existing reads to treat missing as 0 during rollout)
- Modify: `packages/backend/convex/demandNotices/mutations.ts`
- Modify: `packages/backend/convex/demandNotices/queries.ts`
- Modify: `apps/web/hooks/reports/useDemandNoticeBulkPdf.ts`
- Modify: `packages/backend/convex/retention.ts` — orphan blob grace cleanup if tracked

---

### Task 1: Pure PDF job transitions

**Files:**
- Create: `packages/backend/convex/lib/demandNoticeJobState.ts`
- Create: `packages/backend/convex/lib/demandNoticeJobState.test.ts`

- [ ] **Step 1: Failing tests** for `queued→rendering→uploading→completed`, reject `completed→rendering`, allow `*→failed` for in-flight.

- [ ] **Step 2: Implement**

```ts
export type DemandNoticeJobStatus =
  | "queued"
  | "rendering"
  | "uploading"
  | "completed"
  | "failed"

const ALLOWED: Record<DemandNoticeJobStatus, readonly DemandNoticeJobStatus[]> = {
  queued: ["rendering", "failed"],
  rendering: ["uploading", "failed"],
  uploading: ["completed", "failed"],
  completed: [],
  failed: [],
}

export function canTransitionDemandNoticeJob(
  from: DemandNoticeJobStatus,
  to: DemandNoticeJobStatus,
): boolean {
  return ALLOWED[from].includes(to)
}

export function assertDemandNoticeJobTransition(
  from: DemandNoticeJobStatus,
  to: DemandNoticeJobStatus,
): void {
  if (!canTransitionDemandNoticeJob(from, to)) {
    throw new Error(`Invalid demand-notice job transition ${from} -> ${to}`)
  }
}
```

- [ ] **Step 3: Tests PASS → commit**

```bash
git commit -m "test: define demand-notice PDF job transitions"
```

---

### Task 2: Schema attempt + mutation CAS

**Files:**
- Modify: `packages/backend/convex/schema.ts`
- Modify: `packages/backend/convex/demandNotices/mutations.ts`

- [ ] **Step 1:** Add `attempt: v.number()` to `demandNoticeExportJobs`. Set `attempt: 0` in `startBulkExport`.

- [ ] **Step 2:** Change `updateExportProgress` args to include `attempt`. Handler:
  1. Load job; if missing throw.
  2. If `job.attempt !== args.attempt` return null (ignore stale).
  3. If `job.status` is `completed`/`failed`/`uploading` return null (ignore).
  4. Else `assertDemandNoticeJobTransition(job.status, "rendering")` and patch progress.

- [ ] **Step 3:** `completeExport` / `failExport` require `attempt`; ignore mismatch; on complete if already completed with same `storageId` return success; if already completed with different storageId delete the losing blob then keep winner.

- [ ] **Step 4:** Add mutation `beginUpload({ jobId, attempt })` transitioning `rendering→uploading`.

- [ ] **Step 5:** Commit

```bash
git commit -m "fix: make demand-notice PDF job transitions attempt-scoped"
```

---

### Task 3: Client resume + await progress

**Files:**
- Modify: `apps/web/hooks/reports/useDemandNoticeBulkPdf.ts`

- [ ] **Step 1:** Store `attempt` from job; await progress mutations (no fire-and-forget).
- [ ] **Step 2:** On mount, if active job for user in `rendering`/`uploading`, resume payload offset from `processedCount`.
- [ ] **Step 3:** Call `beginUpload` before upload URL; then `completeExport`.
- [ ] **Step 4:** Commit

```bash
git commit -m "fix: resume demand-notice PDF jobs and stop stale progress writes"
```

---

### Task 4: Orphan upload cleanup

**Files:**
- Modify: `packages/backend/convex/retention.ts` or demand-notice internals

- [ ] **Step 1:** Track pending uploads: either store `pendingStorageId` on job during upload, clear on complete, or record `orphanStorageCandidates` table with `createdAt`.
- [ ] **Step 2:** Retention deletes `pendingStorageId` for failed/stale jobs and candidates older than 1 hour not referenced by any completed job.
- [ ] **Step 3:** Commit

```bash
git commit -m "fix: clean orphaned demand-notice PDF uploads"
```

---

### Task 5: Verification

- [ ] Backend tests pass
- [ ] Manual: start bulk PDF, refresh mid-run, confirm resume; complete; fire delayed progress in console — status stays completed

---

## Self-review vs spec

| Spec item | Task |
|---|---|
| Monotonic state machine | 1–2 |
| Attempt CAS / ignore late progress | 2–3 |
| Resume after refresh | 3 |
| Orphan blob hygiene | 4 |
| Keep browser capture / 200 cap | all tasks (no changes to those) |
