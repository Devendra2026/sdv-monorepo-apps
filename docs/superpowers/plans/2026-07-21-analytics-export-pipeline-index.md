# Analytics + Export Pipeline — Plan Index

> **For agentic workers:** Execute plans in order. Each plan produces independently testable software.

**Spec:** `docs/superpowers/specs/2026-07-21-analytics-export-pipeline-redesign.md`

## Execution order

| Order | Plan | Outcome |
|---|---|---|
| 1 | `docs/superpowers/plans/2026-07-21-convex-analytics-refactor.md` (+ gap tasks below) | Dashboard/reports stop scanning live surveys; p95 &lt; 500 ms target |
| 2 | `docs/superpowers/plans/2026-07-21-excel-export-import-jobs.md` | Reliable queued Excel download/import with streaming writer |
| 3 | `docs/superpowers/plans/2026-07-21-demand-notice-pdf-control-plane.md` | Monotonic, resumable demand-notice PDF jobs |

## Gap tasks to prepend to the analytics plan

Before creating any non-legacy generation rows, complete these (TDD):

1. **Legacy `.unique()` safety** — readers/writers that use `by_municipality` / `by_municipality_date` / `by_municipality_ward` / `by_surveyor_municipality` must filter `generation === undefined` (or stop using those indexes once dual-write starts). Prefer generation indexes once meta is active.
2. **Draft→draft dimension writes** — remove the skip in `surveys/mutations.ts` `saveDraft` so municipality/ward/surveyor moves update aggregates.
3. **Completion fan-in** — `refreshSurveyCompletionPct`, floors, photos, GPS must call aggregate maintenance with before/after snapshots.
4. **Import atomicity** — do not catch errors after source patch + failed rollup; per-row try/catch may only wrap whole row transactions that include aggregates.
5. **Stop live KPI fallbacks** only after generation readiness validation (existing plan Task for cutover).

## Global constraints (all plans)

- Convex + existing web app only; no dedicated worker service.
- Preserve public API response shapes unless additive fields are explicitly versioned.
- No silent truncation on Excel or analytics historical KPIs.
- Self-hosted compatible: bounded queries/mutations, awaited scheduler, internal-only scheduled functions.
- Excel artifacts: 24h retention; demand-notice PDF retention stays ~7d/3d unless changed later.
