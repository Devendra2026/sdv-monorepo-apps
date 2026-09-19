# Convex backend unhealthy startup — diagnosis

**Date:** 2026-09-19  
**Status:** Implemented (repo + ops runbooks)  
**Scope:** Self-hosted Convex on Dokploy (`sdv-edutech-convex-dbwplu-backend-1`)  
**Data safety:** No volumes deleted, no DB reset, no VACUUM, no production data mutation from this work.

See also: [docs/superpowers/README.md](../README.md) · [query timeout fix](./2026-09-19-convex-query-timeout-fix-design.md)

---

## A. Exact root cause

Two coupled layers:

### A1. Docker failure mode (why deploy says unhealthy)

**Before (broken):**

```text
curl -f http://localhost:3210/version
interval=30s timeout=5s retries=5 start_period=40s
→ unhealthy after ≈ 190s (~3.2 min) if /version not ready
```

**After (implemented in compose):**

```text
same probe; start_period=900s (15 min)
→ health failures do not count until cold start window elapses
```

Production timeline that justified 900s:

| Time | Event |
|------|--------|
| 11:21:54 | `Starting a Convex backend`; SQLite connect OK; Searchlight starting |
| 11:27:04 | `Bootstrapping indexes…` / `Loading 8 tables with 21 indexes` (~5 min silent gap) |
| 11:31:54 | `Starting a Convex backend` again (full process restart) |

By ~11:25 the old config marked the container **unhealthy** while still in cold start. Dashboard `depends_on: service_healthy` then failed with `dependency failed to start`.

**Healthcheck is the reporter of failure during cold start, not the cause of the multi-minute SQLite bootstrap.**

### A2. Why cold start takes several minutes

1. Backend uses **SQLite** at `/convex/data/db.sqlite3` (named volume `sdv-convex-data` → `/convex/data`).
2. Observed gap: Searchlight start → ~5 minutes → system index bootstrap log.
3. On healthy small DBs, the same bootstrap lines appear within **milliseconds to tens of seconds** (upstream boot traces / [convex-backend#96](https://github.com/get-convex/convex-backend/issues/96)).
4. Production image `ghcr.io/get-convex/convex-backend:5cdea511cd6527a95dd24152ea0d3c3bb2ab379f` resolves to commit **2026-02-24**.
5. Upstream [issue #495](https://github.com/get-convex/convex-backend/issues/495) documents SQLite `index_scan` / `load_documents` materializing entire ranges; boot-time search bootstrap can scale with document-log size. PRs #522 / #551 were **not merged** as of this diagnosis.
6. App schema has **27 tables / 78 indexes** (`surveys` alone has 14). The log line `Loading 8 tables with 21 indexes` is **system bootstrap tables**, not the app schema size.

**Root cause summary:** Large SQLite persistence makes process cold-start exceed a short compose health budget. Orchestration marks the backend unhealthy / fails dependent services; process may restart mid-bootstrap, amplifying the loop.

---

## B. Evidence

| Evidence | Source | Result |
|----------|--------|--------|
| Health budget math (before) | compose `start_period: 40s` | ~190s to unhealthy |
| Health budget (after) | compose `start_period: 900s` | cold start covered with margin |
| Startup timeline | Production backend logs | 5 min silence; restart ~10 min |
| SQLite path | Production logs | `Connected to SQLite at /convex/data/db.sqlite3` |
| Volume mapping | compose | `convex_data` → `/convex/data` (`sdv-convex-data`) |
| Image pin | compose default + `compose.env.example` | `5cdea511…` |
| System vs app indexes | schema.ts + upstream traces | 8/21 = system; app = 27/78 |
| Prior runtime timeouts | [query-timeout design](./2026-09-19-convex-query-timeout-fix-design.md) | Fan-out `queryStreamNext` (related SQLite pressure) |
| Public Traefik (2026-09-19) | HTTPS probes | API `/` + `/version` 200; site `/version` 200 |

Host `du` / OOMKilled: run `inspect-convex-host.sh` + `diagnose-container-restart.sh` on Dokploy.

---

## C. Database / index issue

| Item | Finding |
|------|---------|
| Persistence | SQLite (default) |
| Hot table | `surveys` with **14** secondary indexes |
| Runtime vs startup | Runtime timeouts = stream fan-out (fixed via `mapInChunks`). Startup = process cold-start. Shared factor: SQLite + large data |
| Do not | Drop indexes or change survey/analytics semantics as first remediation |

---

## D. Docker issue

| Question | Answer |
|----------|--------|
| Restart mode | **A (primary):** healthcheck unhealthy before HTTP ready |
| C OOM | Unproven without host inspect |
| Fix applied | `start_period: 900s`; pin backend digest; keep `GET /version` |

---

## E. Files changed (implementation)

| File | Why |
|------|-----|
| `infra/convex-self-hosted/docker-compose.yml` | `start_period: 900s`; pinned image default |
| `infra/convex-self-hosted/compose.env.example` | Pin tag + health notes |
| `infra/convex-self-hosted/README.md` | Cold-start runbook |
| `infra/convex-self-hosted/inspect-convex-host.sh` | Health.Log + in-container `/version` |
| `infra/convex-self-hosted/diagnose-container-restart.sh` | Restart mode A–E classifier |
| `infra/convex-self-hosted/verify-convex-traefik-routing.sh` | API + site `/version` |
| `infra/convex-self-hosted/verify-production-health.sh` | Thin public health entrypoint |
| `packages/backend/scripts/deploy-convex-production.mjs` | Preflight requires `/version` 200 |
| `packages/backend/convex/shared/tenancy.ts` | Chunk district→municipality fan-out with `mapInChunks` |
| `docs/superpowers/README.md` | Spec index + apply order |
| This file | Diagnosis A–H |

---

## F. Data safety

- No `docker compose down -v` / volume rm / `db.sqlite3` delete / live VACUUM / DB reset.

---

## G. Performance

| Metric | Value |
|--------|-------|
| Cold-start silence (prod log) | ~5 min |
| Process restart (prod log) | ~10 min |
| Health fail budget (before) | ~3.2 min |
| Health start_period (after) | 900s |
| Synthetic queries (vitest 24 ULBs) | See query-timeout design; stream-budget tests pass |

---

## H. Remaining (ops on Dokploy — not code)

1. Redeploy compose on Dokploy with `start_period: 900s` + pinned tag; keep `INSTANCE_SECRET` + volume.
2. Mirror 900s start period in Dokploy UI if it overrides compose.
3. Run `inspect-convex-host.sh` / `diagnose-container-restart.sh` for OOMKilled + `du`.
4. Long-term: Postgres for large SQLite; watch upstream #495.
5. After healthy redeploy: `pnpm convex:deploy:production` then smoke dashboard.

---

## Dependency graph

```text
dashboard → backend (healthy, GET :3210/version, start_period 900s)
backend → sdv-convex-data → /convex/data/db.sqlite3
backend → dokploy-network → Traefik (api:3210, site:3211)
```
