# Superpowers specs — Convex production stability

Index of design docs that drive production Convex behavior for this monorepo.

| Spec                                                                                                                   | Status                        | What it fixes                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| [2026-09-19-convex-query-timeout-fix-design.md](./specs/2026-09-19-convex-query-timeout-fix-design.md)                 | **Implemented**               | Runtime `queryStreamNext` / SystemTimeout via `mapInChunks` stream budgets                                       |
| [2026-09-19-convex-backend-unhealthy-startup-design.md](./specs/2026-09-19-convex-backend-unhealthy-startup-design.md) | **Implemented** (repo)        | Docker unhealthy during SQLite cold start — compose `start_period: 900s`, pinned image, ops scripts              |
| [2026-09-19-convex-latency-diagnosis-design.md](./specs/2026-09-19-convex-latency-diagnosis-design.md)                 | **Diagnosed + minimal fixes** | Post-mapInChunks timeouts: ETL audit page 500, unique actor hydration, audit UI window 250, serial dashboard SSR |

## Production apply order

1. **Infra (Dokploy host)** — apply [`infra/convex-self-hosted/`](../../infra/convex-self-hosted/README.md) compose (keep volume `sdv-convex-data`, keep `INSTANCE_SECRET`). Mirror health **start period 900s** in Dokploy UI if it overrides compose.
2. **Verify routing** — `bash infra/convex-self-hosted/verify-convex-traefik-routing.sh`
3. **Host inspect** — `bash infra/convex-self-hosted/inspect-convex-host.sh` and `diagnose-container-restart.sh`
4. **Deploy functions** — `pnpm convex:deploy:production` (requires healthy API, not Traefik 404)
5. **Regression** — `pnpm --filter @workspace/backend test`

## Non-negotiables

- Do not `docker compose down -v` / delete `db.sqlite3` / live VACUUM.
- Do not disable the `/version` healthcheck.
- Do not change survey/analytics/auth business semantics to “fix” timeouts.
- Longer `start_period` covers measured cold start; large SQLite still warrants Postgres later.
