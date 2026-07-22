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
 * Ops: prefer off-peak CLI/volume backups; prune platform export blobs with
 * scripts/prune-convex-platform-exports.sh (dry-run by default). Do not stack
 * storage-inclusive exports under low disk.
 */
import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()

// Daily at 02:30 IST-ish via UTC: 21:00 UTC = 02:30 IST next calendar day.
// Prefer cron expression over interval so sweeps stay off-peak and predictable.
crons.cron("retention sweep export jobs and notifications", "0 21 * * *", internal.retention.runRetentionSweep, {})

export default crons
