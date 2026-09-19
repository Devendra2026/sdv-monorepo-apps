# Convex self-hosted on Dokploy

#

# Source of truth for Docker Compose + Traefik labels used on the Dokploy host.

# Upstream reference (verify before inventing new env vars):

# https://github.com/get-convex/convex-backend/blob/main/self-hosted/docker/docker-compose.yml

# https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md

#

# This document cannot certify uptime, CPU, memory, or disk without host

# measurements. Apply config carefully; do not delete production volumes.

## Ports

| Port     | Purpose                                            |
| -------- | -------------------------------------------------- |
| **3210** | Convex API / sync / CLI (`CONVEX_SELF_HOSTED_URL`) |
| **3211** | HTTP actions (`CONVEX_SITE_ORIGIN`)                |
| **6791** | Optional Convex dashboard (internal / VPN only)    |

## Domains

- `api.sdvedutech.in` → container **3210**
- `site.sdvedutech.in` → container **3211**

Healthy API root: `curl -i https://api.sdvedutech.in/` should return Convex
running text, **not** Traefik's bare `404 page not found`.

Cheap liveness: `curl -i https://api.sdvedutech.in/version` (HTTP 200; body may
be a version string or `unknown` depending on image build — status code matters).

## Isolate restarts vs container restarts

| Signal                                                                      | Layer                                              | Typical cause                                         | What helps                                                        |
| --------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------- |
| Log line `Restarting Isolate` / `UserTimeout` / `UnhandledPromiseRejection` | **Application isolate** inside a healthy container | Heavy/failing Convex functions                        | Fix app code; container restart alone does not address root cause |
| Docker/Swarm task restart, OOMKilled, exit ≠ 0                              | **Container / process**                            | OOM limits, disk full, panic, failed healthcheck loop | Host resources, volume space, healthcheck timing, image health    |
| Traefik `404 page not found` on API host                                    | **Routing**                                        | Domain not mapped to :3210                            | Dokploy/Traefik domain → port 3210                                |

Do not treat isolate restarts as proof of Docker misconfiguration without
container restart evidence (`docker inspect` RestartCount, OOMKilled, State).

### Stuck snapshot export → process restart loop (production evidence 2026-07-21)

Symptoms in backend logs:

1. `Export … progress: Backing up _storage`
2. Gap, then `Starting a Convex backend` (full process restart — not isolate)
3. `In progress export restarting…` then again `Backing up _storage`
4. Repeat

Cause: a dashboard/`convex export --include-file-storage` job that never finishes
under disk/memory pressure. On every boot Convex resumes the in-progress export,
which can immediately stress the host again.

Immediate mitigation on the host:

1. Stop starting new exports until the loop is broken.
2. Free disk under the Convex volume (`du -sh /convex/data/storage/*`).
3. Prefer DB-only backups: `BACKUP_INCLUDE_STORAGE` unset/`0` in
   `packages/backend/scripts/backup-convex.mjs` (default after 2026-07-21).
4. After stability returns, run storage-inclusive exports only off-peak with
   `BACKUP_INCLUDE_STORAGE=1` and enough free RAM/disk.
5. Set integer timeouts in Dokploy env (never blank):
   `ACTIONS_USER_TIMEOUT_SECS=600` (empty values log `ParseIntError` on boot).

## Required secrets (Dokploy / compose `.env`)

Copy [`compose.env.example`](./compose.env.example) beside the compose file on
the host (never commit real secrets).

```bash
INSTANCE_SECRET=<stable secret for this instance>
CONVEX_CLOUD_ORIGIN=https://api.sdvedutech.in
CONVEX_SITE_ORIGIN=https://site.sdvedutech.in
# Strongly recommended for production:
CONVEX_BACKEND_TAG=<pinned tag or digest>
CONVEX_DASHBOARD_TAG=<same pin family>
```

Generate admin key after first boot:

```bash
docker compose -f infra/convex-self-hosted/docker-compose.yml exec backend ./generate_admin_key.sh
```

Store as `CONVEX_SELF_HOSTED_ADMIN_KEY` for CLI deploys
(`packages/backend/.env.production`).

## Disk growth — paths & mitigations

Default data root inside the volume: `/convex/data`
(`SQLITE_DB=/convex/data/db.sqlite3`, `STORAGE_DIR=/convex/data/storage` per
upstream `run_backend.sh`).

| Path inside volume               | Cause                   | Mitigation                                                                       |
| -------------------------------- | ----------------------- | -------------------------------------------------------------------------------- |
| `storage/exports`                | CLI / dashboard exports | Prefer `S3_STORAGE_EXPORTS_BUCKET`; prune laptop backups via `backup-convex.mjs` |
| `storage/files`                  | Photos + export PDFs    | App retention cron; S3 files bucket                                              |
| `storage/search`                 | Search indexes          | S3 offload when configured                                                       |
| `storage/modules`                | Deployed bundles        | Normal growth with deploys                                                       |
| `db.sqlite3` (+ `-wal` / `-shm`) | Document store          | Keep `DOCUMENT_RETENTION_DELAY` stable; consider Postgres for large tenants      |
| Docker `json-file` logs          | Container stdout        | Compose rotation; host `daemon.json` log-opts                                    |

### Dokploy Advanced checklist (human)

Configure in Dokploy UI if not using this compose file as the sole service def:

1. **Volume mount:** named volume or bind → `/convex/data` (required for persistence across redeploys).
2. **Health check (liveness):** `CMD-SHELL curl -f http://127.0.0.1:3210/version` — interval ≥ 30s, start period ≥ 40s, retries ≥ 5. Do **not** probe authenticated export URLs.
3. **Restart policy:** `on-failure` with delay ≥ 10s and capped `max_attempts` (avoid tight restart loops). Prefer not `always` on a permanently misconfigured service.
4. **Resources:** set **reservation** and **limit**. Too-low memory limit → OOMKilled (container restart). Example starting point: reserve 2G / limit 4G for backend (tune from `docker stats`).
5. **Log rotation:** json-file `max-size` / `max-file` (compose includes this; also set daemon defaults).
6. **Domains:** `api` → **3210**, `site` → **3211**. If Dokploy domain UI already sets Traefik routers, remove duplicate compose Traefik labels to avoid conflicts.
7. **Web app health:** Dokploy probe `GET /health` on port **3000** (Railpack `HEALTHCHECK_PATH` alone is not a Swarm healthcheck).

### Host disk hygiene (safe, manual)

```bash
df -h
docker system df
docker ps -a --filter name=convex --format 'table {{.Names}}\t{{.Status}}\t{{.RunningFor}}'
# Read-only inspect helper (this repo):
bash infra/convex-self-hosted/inspect-convex-host.sh
```

Safe prune of unused images/builders (does **not** delete named volumes):

```bash
docker image prune -af --filter "until=168h"
docker builder prune -af --filter "until=168h"
```

Never run `docker volume rm` / `docker compose down -v` against production
`sdv-convex-data` without an verified export.

## SQLite maintenance (manual, high risk)

Convex manages SQLite internally. **Do not** run ad-hoc live
`VACUUM` / `wal_checkpoint` / PRAGMA tuning against `/convex/data/db.sqlite3`
while the backend is accepting traffic — risk of corruption, lock storms, and
unsupported operational state.

If disk reclaim is required:

1. Take a logical export: `pnpm --filter @workspace/backend convex:backup` (or `npx convex export --env-file .env.production`).
2. Stop external traffic / stop the backend container.
3. Only then consider offline maintenance or migrate to Postgres/MySQL per
   [upstream docs](https://github.com/get-convex/convex-backend/blob/main/self-hosted/advanced/postgres_or_mysql.md).
4. Prefer Postgres/MySQL for production durability over routine SQLite VACUUM.

This repo does **not** auto-enable VACUUM or checkpoint scripts.

## Backups

Laptop/CI logical backup (includes file storage when using
`--include-file-storage`):

```bash
pnpm --filter @workspace/backend convex:backup
```

Keeps the newest `MAX_BACKUPS` (default 30) ZIP files under
`packages/backend/backup/convex/` (gitignored). Copy ZIPs **off the Dokploy
host** — same-disk backups do not survive volume loss.

Restore drill (maintenance window; destructive to target deployment):

1. Export current prod.
2. Point CLI at an isolated restore target (never improvise on live without approval).
3. `npx convex import --replace-all --env-file ...` per upstream upgrading docs.
4. Re-set Convex env vars (`CLERK_*`, etc.).

## Verify routing

On a machine that can reach production DNS:

```bash
bash infra/convex-self-hosted/verify-convex-traefik-routing.sh
```

On the Dokploy host (container/network diagnostics):

```bash
bash packages/backend/scripts/diagnose-convex-export-404.sh
bash infra/convex-self-hosted/inspect-convex-host.sh
```

## Deploy functions (from laptop)

```bash
pnpm convex:deploy:production
```

Requires `packages/backend/.env.production` (see
`packages/backend/.env.example`). Never put admin keys in `NEXT_PUBLIC_*`.

## Validate compose (local, non-destructive)

```bash
docker compose -f infra/convex-self-hosted/docker-compose.yml --env-file infra/convex-self-hosted/compose.env.example config
```

Does not deploy or touch production volumes.
