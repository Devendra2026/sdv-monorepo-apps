# Convex production latency diagnosis (post-mapInChunks)

**Date:** 2026-09-19  
**Status:** Diagnosed + minimal fixes applied (deploy required)  
**Scope:** Persistent `SystemTimeout` / `queryStreamNext` after stream-budget deploy  
**Related:** [query-timeout-fix](./2026-09-19-convex-query-timeout-fix-design.md) · [unhealthy-startup](./2026-09-19-convex-backend-unhealthy-startup-design.md)

## 1. Root cause

**Primary (proven):** Shared self-hosted SQLite `queryStreamNext` syscall budget starvation under concurrent load — not a missing `auditLogs` index and not “only” `/etl/audit/list`.

**Amplifiers (proven in code + timeout targets):**

1. ETL `listAuditLogs` default/max page of **5000** audit docs + up to **5000** `users.get` per UDF invocation.
2. Dashboard SSR still starting **multiple concurrent** preloads (`counts` ∥ `recentActivity` ∥ `analyticsBundle`, then QC) after `mapInChunks`.
3. Audit UI `summary` / `actionFacets` each `take(1000)` newest rows when the audit page is open.

**Infrastructure (partially proven, host paste still incomplete):** Prior same-day startup logs show multi-minute SQLite cold start on `/convex/data/db.sqlite3` with Docker unhealthy when `start_period` was too short. Live `OOMKilled` / `db.sqlite3` byte size / disk saturation were **not** captured in this session (operator paste pending).

## 2. Evidence

| Evidence                                                                          | Source                                                                       | Implication                                      |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------ |
| `etl/queries.js:listAuditLogs` → `SystemTimeout` / `queryStreamNext` 15s          | Operator production logs                                                     | That UDF exceeds syscall budget                  |
| Same class on `analyticsBundle`, `counts`, `recentActivity`, `qcSupervisorBundle` | Operator logs                                                                | Not an ETL-only bug                              |
| `_system/frontend/modules.js` / `components.js` timeout                           | Operator logs                                                                | Isolate/DB contention, not app-query logic alone |
| WebSocket `/api/.../sync` 101 OK; some `/etl` slow but OK                         | Operator                                                                     | Network path up; DB work is the bottleneck       |
| Storage sometimes ~35s                                                            | Operator                                                                     | I/O pressure under load                          |
| `listAuditLogs` uses `by_creation_time` + `.take` (not `.collect`)                | Repo                                                                         | Correct index; page size too large               |
| `mapInChunks` already deployed                                                    | Operator confirmed                                                           | Remaining timeouts are post-fix amplifiers       |
| Public `GET /version` ~350–430ms                                                  | This session probe                                                           | Backend currently alive; timeouts are load-path  |
| Cold start ~5–10+ min on SQLite                                                   | [unhealthy-startup](./2026-09-19-convex-backend-unhealthy-startup-design.md) | Large local DB / slow disk still in play         |

### Evidence still required (host)

Paste stdout of:

```bash
bash infra/convex-self-hosted/inspect-convex-host.sh
bash infra/convex-self-hosted/diagnose-container-restart.sh
docker logs --since 2h "$CONTAINER" 2>&1 | grep -E 'SystemTimeout|queryStreamNext|OOM|Restarting Isolate' | tail -200
```

Needed to close: SQLite file/WAL size, OOMKilled, RestartCount correlation, disk free %.

## 3. Slow queries (matrix)

| Query                          | Table(s)                  | Filter / sort                                 | Existing index                                     | Usable? | Max docs / pattern                          | Recommendation                        |
| ------------------------------ | ------------------------- | --------------------------------------------- | -------------------------------------------------- | ------- | ------------------------------------------- | ------------------------------------- |
| `etl.listAuditLogs`            | `auditLogs`, `users`      | `_creationTime >= cursor`, asc; unique actors | system `by_creation_time`; `users` by id           | Yes     | Was 5064 + N gets; now ≤564 + unique actors | Keep index; smaller page (done)       |
| `etl.listAuditIdsInWindow`     | `auditLogs`               | creation window + cursor                      | `by_creation_time`                                 | Yes     | Same page cap                               | Same page cap (done)                  |
| `audit.summary`                | `auditLogs`               | newest window                                 | `by_creation_time`                                 | Yes     | Was 1000; now 250                           | Bound window (done)                   |
| `audit.actionFacets`           | `auditLogs`               | newest window                                 | `by_creation_time`                                 | Yes     | Was 1000; now 250                           | Bound window (done)                   |
| `audit.listPaginated`          | `auditLogs`               | filters + paginate                            | `by_entity*` / `by_actor` / `by_action` / creation | Yes     | Convex page                                 | Keep                                  |
| `analytics.counts`             | rollups                   | scoped ULBs                                   | municipality/daily/ward stats indexes              | Yes     | Cap 12 ULBs                                 | Already chunked                       |
| `analytics.analyticsBundle`    | rollups + users + qc      | multi-ULB takes                               | yes                                                | Yes     | Fan-out × take                              | Already chunked + phased              |
| `analytics.qcSupervisorBundle` | users + qcDecisions       | per ULB take                                  | `by_municipality_*`                                | Yes     | ≤12 ULBs × takes                            | Already chunked                       |
| `analytics.recentActivity`     | surveys + users           | scoped take 20                                | `by_municipality_status`                           | Yes     | Budget 80 multi-ULB                         | Already chunked                       |
| Admin catalog (`tenancy`)      | districts, municipalities | active                                        | `by_active` / collect                              | Catalog | Small                                       | OK                                    |
| `tenants/wardAudit`            | surveys × status          | full ULB collect                              | status indexes                                     | Yes     | **Severe if run**                           | Ops-only; do not run on prod casually |
| `_system/frontend/*`           | system                    | —                                             | —                                                  | —       | Contends for same DB                        | Fix load, not system code             |

**Verdict:** Multiple functions are independently bounded but **share one SQLite syscall budget**. After `mapInChunks`, the remaining smoking guns were oversized ETL audit pages, audit UI windows, and concurrent SSR preloads.

## 4. Schema indexes (`auditLogs`)

```text
by_entity          [entity, entityId]
by_actor           [actorId]
by_action          [action]
by_entity_action   [entity, action]
+ system by_creation_time
```

ETL list pattern matches **system `by_creation_time`** — no new composite index required for that path.

## 5. Full scans / `.collect()` classification

- **No** hot-path `query().filter(q => …).collect()` anti-pattern found.
- **Bounded `.take()`** dominates analytics/ETL.
- **Catalog `.collect()`** (districts/municipalities/RBAC) — low risk unless concurrent stampede.
- **Severe:** `tenants/wardAudit.ts` full survey collects per status (ops internal).
- **Fake pagination:** survey multi-ULB `listPaginated` offset window; QC client slice — document only; not changed this cycle.

## 6. Pagination

| Surface                    | Real Convex pagination?                               |
| -------------------------- | ----------------------------------------------------- |
| Audit UI list              | Yes (`listPaginated`)                                 |
| ETL audit                  | Cursor `.take` + continuation (real; not offset fake) |
| Survey registry single-ULB | Yes                                                   |
| Survey multi-ULB           | Hybrid window + slice                                 |
| Analytics home             | Not a list — full bundles                             |

## 7. Table sizes

| Source                                | Result                                                                             |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| Convex Cloud MCP `prod`               | Schema present; one-off count blocked (PII gate); **not** the self-hosted instance |
| Self-hosted `/convex/data/db.sqlite3` | Size **unknown** until host inspect paste                                          |
| Growth signal                         | Cold-start duration and SystemTimeout under load imply large document log          |

Do not truncate / VACUUM / delete production tables.

## 8. Resource / Docker

| Item                           | Known                                               |
| ------------------------------ | --------------------------------------------------- |
| Volume                         | `sdv-convex-data` → `/convex/data`                  |
| Compose limits                 | 2 CPU / 4G (defaults)                               |
| Health                         | `start_period: 900s` (repo); Dokploy UI must mirror |
| INSTANCE_NAME env              | `sdv-production` (folder name ≠ instance)           |
| Live OOM / RestartCount / disk | **Await host paste**                                |
| Public liveness                | API/SITE `/version` 200 in ~400ms (this session)    |

## 9. Request concurrency

| Path                                | Behavior                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `DashboardContent` SSR              | **Was** `counts` ∥ `activity` ∥ (`analytics`→`qc`). **Now** fully sequential. |
| `DashboardHomeClient` vs `Fallback` | Mutually exclusive — no double mount when SSR succeeds                        |
| Fallback client                     | Still mounts 3 live queries if SSR fails — acceptable recovery path           |
| Activity + home                     | Same page; sequential SSR reduces peak                                        |

No frontend cache band-aid added.

## 10. Baseline timings

| Metric                       | Before (production logs / prior design) | After (this change, pre-deploy)                                   |
| ---------------------------- | --------------------------------------- | ----------------------------------------------------------------- |
| `listAuditLogs`              | SystemTimeout 15s class at page=5000    | Expect ≤500 docs/page; **measure after deploy**                   |
| Analytics UDFs               | Multi-second / timeout under load       | Expect lower contention with serial SSR; **measure after deploy** |
| Public `/version`            | —                                       | p≈400ms (this session; not UDF baseline)                          |
| Synthetic 24-ULB (prior fix) | After mapInChunks: analytics tens of ms | Still valid for fan-out; does not model ETL 5k                    |

**Error rate before:** repeated SystemTimeout on listed UDFs + `_system/*`.  
**Error rate after:** unknown until production deploy + host correlation.

## 11. Minimal fixes applied (Phase E)

| Change                                  | File(s)                                      | Behavior preserved?                              |
| --------------------------------------- | -------------------------------------------- | ------------------------------------------------ |
| `MAX/DEFAULT_AUDIT_ETL_PAGE` 5000 → 500 | `lib/budgetLimits.ts`, `etl/queries.ts`      | Yes — cursor pages; clients loop                 |
| Unique-actor hydration for ETL audit    | `etl/queries.ts`                             | Yes — same enrichment, fewer gets                |
| Audit UI window 1000 → 250              | `audit/queries.ts`, `AUDIT_UI_RECENT_WINDOW` | Yes — still capped recent window (`capped` flag) |
| Dashboard SSR single-flight             | `dashboard-content.tsx`                      | Yes — same preloads, sequential                  |

**Not done (insufficient host proof):** raise Docker memory/CPU; Postgres migration; VACUUM; timeout increase; empty-array fallbacks.

## 12. Business logic preserved

Unchanged: survey/ULB/pincode rules, QC workflow, permissions, ETL record shape/cursor meaning, audit action/entity semantics (window size for facets/summary only).

## 13. Tests / checks

- `pnpm --filter @workspace/backend test` (budgetLimits + existing)
- Typecheck/lint as available

## 14. Remaining risks

1. Host SQLite size / disk I/O may still dominate until measured and possibly migrated to Postgres.
2. `DashboardHomeFallback` still fires concurrent client queries if SSR fails.
3. ETL clients that assumed one 5000-row response must loop (cursor already supported).
4. Without deploy, production continues on old page sizes.

## 15. Deploy

After backend healthy:

```bash
pnpm convex:deploy:production
pnpm --filter @workspace/backend test
bash infra/convex-self-hosted/verify-production-health.sh
```
