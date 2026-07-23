/**
 * Retention / disk hygiene for self-hosted Convex (application tables only).
 *
 * Scope:
 *   - `demandNoticeExportJobs` (+ PDF blobs in Convex file storage)
 *   - read `notifications`
 *
 * NOT in scope (do not confuse with this module):
 *   - Platform snapshot exports under /convex/data/storage/exports/*.blob
 *     written by `application::exports::worker` after CLI/dashboard
 *     `POST /api/export/request/zip`. Those must be pruned on the host
 *     (see scripts/prune-convex-platform-exports.sh) — app crons cannot
 *     delete that directory.
 *
 * Demand-notice PDFs and completed job rows accumulate forever without this.
 * Batched deletes keep each mutation under transaction limits.
 *
 * Load posture (self-hosted SQLite):
 *   - Small batches + paced runAfter so deletes do not storm queryPage during
 *     platform ZIP exports.
 *   - Serial sweeps (export jobs, then notifications) — never dual runAfter(0).
 *   - Early-exit once past the retention horizon (ASC by createdAt / creation time).
 *   - Quiet window for logical backups: avoid overlapping 20:30–22:30 UTC
 *     (see scripts/backup-convex.mjs). Preferred backup slot ~03:00 UTC.
 */
import { v } from "convex/values"
import { internal } from "./_generated/api"
import { internalMutation } from "./_generated/server"

const EXPORT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const FAILED_EXPORT_RETENTION_MS = 3 * 24 * 60 * 60 * 1000
const READ_NOTIFICATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000
/** Smaller batches reduce SQLite write lock duration under export load. */
const BATCH_SIZE = 20
/** Pace between retention pages so platform export queryPage is less likely to hit 15s. */
const BATCH_DELAY_MS = 2_000

function shouldKeepExportJob(job: { status: string; createdAt: number }, now: number): boolean {
  const age = now - job.createdAt
  if (job.status === "completed" && age < EXPORT_RETENTION_MS) return true
  if (job.status === "failed" && age < FAILED_EXPORT_RETENTION_MS) return true
  if (
    (job.status === "queued" || job.status === "rendering" || job.status === "uploading") &&
    age < EXPORT_RETENTION_MS
  ) {
    return true
  }
  return false
}

/** Delete one batch of expired demand-notice export jobs (+ storage blobs). */
export const purgeExpiredExportJobs = internalMutation({
  args: {
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    deleted: v.number(),
    done: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now()
    const page = await ctx.db
      .query("demandNoticeExportJobs")
      .withIndex("by_createdAt")
      .order("asc")
      .paginate({ cursor: args.cursor ?? null, numItems: BATCH_SIZE })

    let deleted = 0
    let keptWithinHorizon = 0
    for (const job of page.page) {
      if (shouldKeepExportJob(job, now)) {
        keptWithinHorizon += 1
        continue
      }

      if (job.storageId) {
        try {
          await ctx.storage.delete(job.storageId)
        } catch {
          // blob may already be deleted
        }
      }
      await ctx.db.delete(job._id)
      deleted += 1
    }

    // ASC by createdAt: if this page had nothing to delete and every row is still
    // within its retention window, newer pages cannot contain expired jobs.
    const hitRetentionHorizon = deleted === 0 && page.page.length > 0 && keptWithinHorizon === page.page.length
    const done = page.isDone || hitRetentionHorizon

    if (!done) {
      await ctx.scheduler.runAfter(BATCH_DELAY_MS, internal.retention.purgeExpiredExportJobs, {
        cursor: page.continueCursor,
      })
      return { deleted, done: false }
    }

    // Serialize: start notification purge only after export-job sweep finishes.
    await ctx.scheduler.runAfter(BATCH_DELAY_MS, internal.retention.purgeOldReadNotifications, {})
    return { deleted, done: true }
  },
})

/**
 * Delete one batch of old read notifications (unread are kept).
 *
 * Creation-time ascending + stop once past retention cutoff (never touches recent rows).
 */
export const purgeOldReadNotifications = internalMutation({
  args: {
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    deleted: v.number(),
    done: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const cutoff = Date.now() - READ_NOTIFICATION_RETENTION_MS
    const page = await ctx.db
      .query("notifications")
      .withIndex("by_creation_time")
      .order("asc")
      .paginate({
        cursor: args.cursor ?? null,
        numItems: BATCH_SIZE,
      })

    let deleted = 0
    let hitRetentionHorizon = false

    for (const row of page.page) {
      // Ascending by creation: once we reach recent rows, nothing older remains.
      if (row._creationTime >= cutoff) {
        hitRetentionHorizon = true
        break
      }
      if (row.readAt === undefined) continue
      await ctx.db.delete(row._id)
      deleted += 1
    }

    const done = page.isDone || hitRetentionHorizon
    if (!done) {
      await ctx.scheduler.runAfter(BATCH_DELAY_MS, internal.retention.purgeOldReadNotifications, {
        cursor: page.continueCursor,
      })
    }

    return { deleted, done }
  },
})

/**
 * Cron entrypoint — starts export-job purge only.
 * Notification purge is chained when export-job sweep completes (serialized).
 * Does not touch platform snapshot exports.
 */
export const runRetentionSweep = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.retention.purgeExpiredExportJobs, {})
    return null
  },
})
