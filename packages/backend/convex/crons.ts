/**
 * Production self-hosted hygiene.
 *
 * IMPORTANT — naming trap:
 * This cron does NOT run Convex platform snapshot exports
 * (`application::exports::worker` → /convex/data/storage/exports/*.blob).
 * Those blobs are created only by `npx convex export` /
 * POST /api/export/request/zip (CLI backup, dashboard, or a host cron).
 *
 * This job only deletes:
 *   - old demand-notice PDF export jobs (`demandNoticeExportJobs` + their storage blobs)
 *   - old read notifications
 * It never touches surveys, survey photos, or platform snapshot export files.
 *
 * Frequency: once per day (was every 6h). App retention does not need sub-daily
 * sweeps; fewer scheduled mutations reduce SQLite load on self-hosted hosts.
 *
 * Schedule / quiet windows (UTC):
 *   - Retention: 21:00 UTC (02:30 IST next calendar day)
 *   - Do NOT run logical ZIP export during 20:30–22:30 UTC (backup-convex.mjs
 *     aborts in that window unless BACKUP_FORCE=1)
 *   - Preferred logical / volume backup slot: ~03:00 UTC (02:00–06:00 quiet band)
 *
 * Ops: prefer volume backup for full DR including _storage; prune platform export
 * blobs with scripts/prune-convex-platform-exports.sh (dry-run by default). Do not
 * stack storage-inclusive exports under low disk.
 *
 * Memory (self-hosted / 8GB hosts):
 *   - Leave OS headroom — target Convex backend RSS well below 3.5GB under load
 *   - Size Docker memory limits so the OOM killer prefers soft cgroup limits first
 *   - Tune Postgres shared_buffers / work_mem for large sorts; watch slow queries (>2s)
 *   - Avoid concurrent Excel export + analytics dashboard on the same host at peak
 */
import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()

// Daily at 02:30 IST-ish via UTC: 21:00 UTC = 02:30 IST next calendar day.
// Prefer cron expression over interval so sweeps stay off-peak and predictable.
crons.cron("retention sweep export jobs and notifications", "0 21 * * *", internal.retention.runRetentionSweep, {})

export default crons
