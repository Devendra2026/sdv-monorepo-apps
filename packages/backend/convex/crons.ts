import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

/**
 * Production self-hosted hygiene.
 *
 * Export PDF blobs + job docs were growing without bound on Dokploy volumes.
 * Read notifications also accumulate; unread are preserved.
 *
 * Ops: prefer off-peak CLI backups; avoid stacking storage-inclusive exports
 * with this sweep under low disk. See infra/convex-self-hosted/README.md
 * (quiet windows). Does not touch surveys or survey photo blobs.
 */
const crons = cronJobs()

crons.interval("retention sweep export jobs and notifications", { hours: 6 }, internal.retention.runRetentionSweep, {})

export default crons
