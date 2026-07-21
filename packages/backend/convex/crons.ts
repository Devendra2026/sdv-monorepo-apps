import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

/**
 * Production self-hosted hygiene.
 *
 * Export PDF blobs + job docs were growing without bound on Dokploy volumes.
 * Read notifications also accumulate; unread are preserved.
 */
const crons = cronJobs()

crons.interval(
  "retention sweep export jobs and notifications",
  { hours: 6 },
  internal.retention.runRetentionSweep,
  {},
)

export default crons
