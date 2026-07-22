/**
 * Retention / disk hygiene for self-hosted Convex.
 *
 * Demand-notice PDFs and completed job rows accumulate forever without this.
 * Batched deletes keep each mutation under transaction limits.
 */
import { v } from "convex/values"
import { internal } from "./_generated/api"
import { internalMutation } from "./_generated/server"

const EXPORT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const FAILED_EXPORT_RETENTION_MS = 3 * 24 * 60 * 60 * 1000
const READ_NOTIFICATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000
const BATCH_SIZE = 40

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
    for (const job of page.page) {
      const age = now - job.createdAt
      const keepCompleted = job.status === "completed" && age < EXPORT_RETENTION_MS
      const keepFailed = job.status === "failed" && age < FAILED_EXPORT_RETENTION_MS
      const keepInFlight =
        job.status === "queued" || job.status === "rendering" || job.status === "uploading"
          ? age < EXPORT_RETENTION_MS
          : false

      if (keepCompleted || keepFailed || keepInFlight) continue

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

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.retention.purgeExpiredExportJobs, {
        cursor: page.continueCursor,
      })
    }

    return { deleted, done: page.isDone }
  },
})

/**
 * Delete one batch of old read notifications (unread are kept).
 *
 * Before: full-table paginate with no early exit → scanned every notification every sweep.
 * After: creation-time ascending + stop once past retention cutoff (never touches recent rows).
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
      await ctx.scheduler.runAfter(0, internal.retention.purgeOldReadNotifications, {
        cursor: page.continueCursor,
      })
    }

    return { deleted, done }
  },
})

/** Cron entrypoint — kicks both retention sweeps. */
export const runRetentionSweep = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.retention.purgeExpiredExportJobs, {})
    await ctx.scheduler.runAfter(0, internal.retention.purgeOldReadNotifications, {})
    return null
  },
})
