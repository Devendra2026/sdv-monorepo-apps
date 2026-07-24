# SDV Monorepo Apps

Next.js web app (`apps/web`) with Convex backend (`packages/backend`) and shared UI (`packages/ui`).

## Local setup

### 1. Install and run

```bash
pnpm install
```

Copy env templates and fill in values:

```bash
cp apps/web/.env.example apps/web/.env.local
cp packages/backend/.env.example packages/backend/.env.local
```

Start Convex and the web app (two terminals):

```bash
cd packages/backend && npx convex dev
```

```bash
pnpm dev
```

### 2. Environment variables

**Web app** (`apps/web/.env.local`):

| Variable                            | Dev                         | Prod                        |
| ----------------------------------- | --------------------------- | --------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_...`               | `pk_live_...`               |
| `CLERK_SECRET_KEY`                  | `sk_test_...` (server only) | `sk_live_...` (server only) |
| `NEXT_PUBLIC_CONVEX_URL`            | from `npx convex dev`       | `https://api.sdvedutech.in` |

**Convex deployment** (set via Dashboard or CLI — not in web `.env.local`):

| Variable                  | Dev                        | Prod                        |
| ------------------------- | -------------------------- | --------------------------- |
| `CLERK_JWT_ISSUER_DOMAIN` | dev Clerk Frontend API URL | prod Clerk Frontend API URL |
| `CLERK_WEBHOOK_SECRET`    | dev webhook signing secret | prod webhook signing secret |

`CONVEX_DEPLOYMENT` in `packages/backend/.env.local` is auto-written by `npx convex dev`.

Verify Convex env:

```bash
cd packages/backend && npx convex env get CLERK_JWT_ISSUER_DOMAIN
```

If unset, set it from the Clerk Convex integration page:

```bash
cd packages/backend && npx convex env set CLERK_JWT_ISSUER_DOMAIN "https://<your-clerk-frontend-api>"
```

Restart `npx convex dev` after changing Convex env vars.

**Critical:** `CLERK_JWT_ISSUER_DOMAIN` on a Convex deployment must match the Clerk instance whose keys the web app uses. Dev Clerk keys require the dev issuer on the dev Convex deployment; prod keys require the prod issuer on prod Convex. Mixing them causes Convex to reject tokens.

### 3. Clerk + Convex auth (required)

Server-side Convex preloads and authenticated queries need a Clerk JWT template named exactly **`convex`**.

For **each** Clerk application (dev and prod):

1. Open [Clerk Convex integration](https://dashboard.clerk.com/apps/setup/convex)
2. Activate the integration (creates the `convex` JWT template)
3. Copy the **Frontend API URL** and set it as `CLERK_JWT_ISSUER_DOMAIN` on the matching Convex deployment (see above)

The template name must match [`apps/web/lib/clerk-convex.ts`](apps/web/lib/clerk-convex.ts) and `applicationID: "convex"` in [`packages/backend/convex/auth.config.ts`](packages/backend/convex/auth.config.ts).

Without this setup you will see:

```
[convex-server] Clerk JWT template 'convex' not found
```

Authenticated server preloads fall back to client queries until the template exists.

### 4. Clerk webhooks (user provisioning)

Convex provisions domain users from Clerk webhooks at `/clerk-webhook`.

For **each** Convex deployment (dev and prod):

1. Get the site URL: `cd packages/backend && npx convex env get CONVEX_SITE_URL`
2. In Clerk Dashboard → Webhooks, add endpoint: `<CONVEX_SITE_URL>/clerk-webhook`
3. Subscribe to `user.created`, `user.updated`, `user.deleted`
4. Copy the signing secret and set it on the same Convex deployment:

```bash
cd packages/backend && npx convex env set CLERK_WEBHOOK_SECRET "whsec_..."
```

## Production deployment

### Web app (Dokploy / build)

Set build-time env vars on the web deployment:

| Variable                            | Value                       |
| ----------------------------------- | --------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...`               |
| `CLERK_SECRET_KEY`                  | `sk_live_...`               |
| `NEXT_PUBLIC_CONVEX_URL`            | `https://api.sdvedutech.in` |

Rebuild after changing `NEXT_PUBLIC_*` variables. If the production site still points at `.convex.cloud`, the browser console will log a warning from [`apps/web/lib/convex.ts`](apps/web/lib/convex.ts).

### Convex production deployment (self-hosted)

Production uses a **self-hosted** Convex backend at `https://api.sdvedutech.in` — not Convex Cloud. Do not run `npx convex deploy` without the self-hosted env file while `CONVEX_DEPLOYMENT` in `.env.local` points at a cloud dev deployment.

**One-time CLI setup** (local machine only):

```bash
cp packages/backend/.env.example packages/backend/.env.production
```

Edit `packages/backend/.env.production` and set:

| Variable                       | Value                                           |
| ------------------------------ | ----------------------------------------------- |
| `CONVEX_SELF_HOSTED_URL`       | `https://api.sdvedutech.in`                     |
| `CONVEX_SELF_HOSTED_ADMIN_KEY` | admin key from your self-hosted Convex instance |

Never commit `.env.production`. Never put `CONVEX_SELF_HOSTED_ADMIN_KEY` in `NEXT_PUBLIC_*` variables.

**Push functions** from the monorepo root:

```bash
pnpm convex:deploy:production
```

On PowerShell, if `CONVEX_DEPLOYMENT` is set in your shell session, clear it first:

```powershell
$env:CONVEX_DEPLOYMENT = $null
pnpm convex:deploy:production
```

**If deploy fails with `/api/get_config_hashes` 404** (or Traefik body `404 page not found`): `api.sdvedutech.in` is not routing to the Convex backend. That is a Dokploy/Traefik issue, not a bad admin key. On the host, ensure the convex-backend container is up and domain `api.sdvedutech.in` points at **port 3210**. Healthy check: `curl -i https://api.sdvedutech.in/` should show Convex running text, not Traefik’s bare 404.

Production compose + Traefik labels + **Dokploy apply checklist** (never recreate the data volume): [`infra/convex-self-hosted/`](infra/convex-self-hosted/README.md).

On the Dokploy host (read-only diagnostics):

```bash
bash infra/convex-self-hosted/inspect-convex-host.sh
bash infra/convex-self-hosted/diagnose-container-restart.sh
bash infra/convex-self-hosted/verify-convex-traefik-routing.sh
bash packages/backend/scripts/diagnose-convex-export-404.sh
```

Isolate logs naming `UDF: testQuery.js:default` are from one-off Convex CLI `--inline-query` / dashboard scratch queries — not app code. Do not add a `testQuery` module. Prefer `internal.tenants.wardAudit.auditDistrictWards` for district audits; never chain multiple `.paginate()` calls in one UDF (use `.collect()` per index or a single paginated stream).

**Backups** (volume-primary DR; logical ZIP is documents-only by default):

| Purpose                          | Command                                                 | When                                                                                                |
| -------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Primary DR** (DB + `_storage`) | `bash packages/backend/scripts/backup-convex-volume.sh` | Prefer **~03:00 UTC**                                                                               |
| Portable documents ZIP           | `pnpm --filter @workspace/backend convex:backup`        | Prefer **~03:00 UTC**; **blocked 20:30–22:30 UTC** (retention quiet window) unless `BACKUP_FORCE=1` |

```bash
# Preferred full DR (includes file storage on disk)
bash packages/backend/scripts/backup-convex-volume.sh

# Logical documents-only ZIP (do not overlap app retention at 21:00 UTC)
pnpm --filter @workspace/backend convex:backup
```

Copy artifacts **off the EC2/Dokploy host**. Same-disk copies are not DR.

**Do not overlap** platform export with app retention, rollup backfills, or storage-inclusive ZIPs under low disk. App retention (`convex/crons.ts`) runs daily at **21:00 UTC** and deletes demand-notice PDF jobs + read notifications only — concurrent deletes contend with export `queryPage` on SQLite (15s syscall timeouts). Prefer one heavy job at a time.

Avoid `BACKUP_INCLUDE_STORAGE=1` on large hosts; use volume backup for `_storage` instead.

**Platform export disk growth** (`/convex/data/storage/exports/*.blob`):

These files are written by Convex's `application::exports::worker` when something
calls `npx convex export` / `POST /api/export/request/zip` — **not** by the app
cron in `convex/crons.ts` (that cron only purges demand-notice PDF jobs + read
notifications). Self-hosted Convex does not auto-delete leftover export blobs.

1. Take a volume backup first: `bash packages/backend/scripts/backup-convex-volume.sh`
2. List prune candidates (default dry-run): `bash packages/backend/scripts/prune-convex-platform-exports.sh`
3. After off-host copy, prune: `DRY_RUN=0 KEEP_NEWEST=2 MIN_AGE_HOURS=24 bash packages/backend/scripts/prune-convex-platform-exports.sh`
4. Stop any host/Dokploy cron that repeatedly triggers `convex export` under low disk.
5. Schedule host backup crons for **~03:00 UTC** (quiet band ~02:00–06:00 UTC), never 20:30–22:30 UTC.

**Memory (8GB EC2 / Docker):** Keep Convex backend RSS under ~3.5GB so the Linux OOM killer does not target it. Leave headroom in the container cgroup limit, size Postgres `shared_buffers` / `work_mem` for large sorts, and avoid stacking Excel export with heavy analytics dashboards. Prefer volume backup for DR; prune leftover platform export blobs (see above).

**Convex deployment env** (Clerk auth on the self-hosted instance — use `--env-file .env.production` with CLI env commands):

```bash
cd packages/backend && npx convex env set CLERK_JWT_ISSUER_DOMAIN "https://<prod-clerk-frontend-api>" --env-file .env.production
cd packages/backend && npx convex env set CLERK_WEBHOOK_SECRET "whsec_..." --env-file .env.production
```

Use the **production** Clerk app's Convex integration page and webhook secret — not the dev values.

**Verify functions** after deploy:

```bash
cd packages/backend && npx convex function-spec --env-file .env.production
```

Confirm `analytics/queries:homeBundle`, `analytics/queries:recentActivity`, and `users/queries:currentUser` appear in the output.

### Route protection

[`apps/web/proxy.ts`](apps/web/proxy.ts) runs `clerkMiddleware()` for session propagation only (no path-based auth gating). Protected routes are enforced at the resource level: [`apps/web/app/(dashboard)/layout.tsx`](<apps/web/app/(dashboard)/layout.tsx>) calls `auth.protect()` for all dashboard pages. Auth pages (`/sign-in`, `/sign-up`) remain public. Add `auth.protect()` to any new API routes, Route Handlers, or Server Actions.

### Post-deploy verification

1. Sign out completely, then sign in fresh (old sessions may carry tokens Convex rejects after issuer changes)
2. Confirm the dashboard loads and Convex queries succeed (`useConvexAuth` reaches authenticated state)
3. Confirm no `[Convex] Production site is connected to Convex Cloud` error in the browser console
4. Visit `/dashboard` without a session — you should be redirected to `/sign-in` by the dashboard layout
5. New sign-ups should provision via webhook (or the client retry in the dashboard account boundary)

### Debug token mismatches

If Convex rejects auth, inspect the JWT `iss` claim vs Convex Dashboard → Settings → Authentication. Ensure `CLERK_JWT_ISSUER_DOMAIN` matches the Clerk Frontend API URL for the same Clerk app as your publishable key.

## Adding components

To add components to your app, run the following command at the root of your `web` app:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

This will place the ui components in the `packages/ui/src/components` directory.

## Using components

To use the components in your app, import them from the `ui` package.

```tsx
import { Button } from "@workspace/ui/components/button";
```
