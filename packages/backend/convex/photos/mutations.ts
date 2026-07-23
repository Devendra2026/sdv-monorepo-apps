import { v } from "convex/values"
import type { Doc } from "../_generated/dataModel"
import { mutation } from "../_generated/server"
import { createRequestId, logMutationTiming } from "../lib/observability"
import { splitKeeperAndDuplicates } from "../lib/safeUnique"
import { refreshSurveyCompletionPct } from "../lib/surveyProgress"
import { photoSlot } from "../schema"
import { hasCapability } from "../shared/capabilities"
import { assertCanAccessSurvey } from "../shared/fieldAccess"
import { clientError, requireUser, writeAudit } from "../shared/helpers"
import { assertSurveyWritable } from "../surveys/helpers"
import { deleteStorageIfPresent } from "./helpers"

/** Returns a one-time upload URL. Valid for ~1 hour by Convex defaults. */
export const generateUploadUrl = mutation({
  args: { surveyId: v.id("surveys") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const survey = await ctx.db.get(args.surveyId)
    if (!survey) clientError("NOT_FOUND", "Survey not found")
    await assertCanAccessSurvey(ctx, me, survey)
    const canUpload =
      (await hasCapability(ctx, me, "surveys.uploadPhotos")) || (await hasCapability(ctx, me, "qc.review"))
    if (!canUpload) clientError("FORBIDDEN", "You don't have permission to upload photos")
    return await ctx.storage.generateUploadUrl()
  },
})

/**
 * Link an already-uploaded blob to a survey. Strictly enforces:
 *  - the storage id resolves to a blob (getUrl)
 *  - the survey is owned by / readable by the caller
 *  - size is sane (≤ 1 MB after the mobile's compression)
 *  - one photo per slot — re-linking the same slot replaces the previous photo
 *
 * Never uses `.unique()` on by_survey_slot — concurrent uploads can create
 * duplicate rows; `.unique()` throws → UnhandledPromiseRejection → isolate restart.
 */
export const linkPhoto = mutation({
  args: {
    surveyId: v.id("surveys"),
    slot: photoSlot,
    storageId: v.id("_storage"),
    sizeKb: v.number(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    capturedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const startedAt = Date.now()
    const requestId = createRequestId()
    let userId: string | undefined
    let cleanedUp = false
    const cleanupBlob = async () => {
      if (cleanedUp) return
      cleanedUp = true
      // Best-effort: if this mutation later throws, Convex rolls back the delete too.
      // Clients should call releaseStorage on upload failure; Convex GC eventually reclaims orphans.
      await deleteStorageIfPresent(ctx, args.storageId)
    }

    try {
      const me = await requireUser(ctx)
      userId = me._id
      const survey = await ctx.db.get(args.surveyId)
      if (!survey) {
        await cleanupBlob()
        clientError("NOT_FOUND", "Survey not found")
      }

      try {
        await assertCanAccessSurvey(ctx, me, survey)
      } catch {
        await cleanupBlob()
        clientError("FORBIDDEN", "You don't have access to this survey")
      }

      try {
        await assertSurveyWritable(ctx, me, survey)
      } catch {
        await cleanupBlob()
        clientError("LOCKED", "Survey is locked — you cannot upload photos in its current state")
      }

      const canUpload =
        (await hasCapability(ctx, me, "surveys.uploadPhotos")) || (await hasCapability(ctx, me, "qc.review"))
      if (!canUpload) {
        await cleanupBlob()
        clientError("FORBIDDEN", "You don't have permission to upload photos")
      }
      if (args.sizeKb <= 0 || args.sizeKb > 1024) {
        await cleanupBlob()
        clientError("VALIDATION", "Photo size out of range (≤ 1 MB)")
      }

      const blobUrl = await ctx.storage.getUrl(args.storageId)
      if (!blobUrl) {
        await cleanupBlob()
        clientError("NOT_FOUND", "Uploaded photo blob not found")
      }

      const slotRows = await ctx.db
        .query("photos")
        .withIndex("by_survey_slot", (q) => q.eq("surveyId", args.surveyId).eq("slot", args.slot))
        .take(4)
      const { keeper: existing, duplicates } = splitKeeperAndDuplicates(slotRows, "newest")

      // Drop race-created extras before linking the new blob.
      for (const dup of duplicates) {
        if (dup.storageId !== args.storageId) {
          await deleteStorageIfPresent(ctx, dup.storageId)
        }
        await ctx.db.delete(dup._id)
      }

      if (existing) {
        if (existing.storageId === args.storageId) {
          logMutationTiming("photos.linkPhoto", startedAt, {
            requestId,
            userId,
            surveyId: args.surveyId,
            outcome: "idempotent",
          })
          return existing._id
        }
        await deleteStorageIfPresent(ctx, existing.storageId)
        await ctx.db.delete(existing._id)
      }

      const id = await ctx.db.insert("photos", {
        surveyId: args.surveyId,
        slot: args.slot,
        storageId: args.storageId,
        sizeKb: args.sizeKb,
        width: args.width,
        height: args.height,
        capturedAt: args.capturedAt,
        uploadedBy: me._id,
      })

      await writeAudit(ctx, {
        actorId: me._id,
        action: "photo.uploaded",
        entity: "survey",
        entityId: args.surveyId,
        metadata: { slot: args.slot, sizeKb: args.sizeKb },
      })
      await refreshSurveyCompletionPct(ctx, survey)
      logMutationTiming("photos.linkPhoto", startedAt, {
        requestId,
        userId,
        surveyId: args.surveyId,
        outcome: "ok",
      })
      return id
    } catch (err) {
      logMutationTiming("photos.linkPhoto", startedAt, {
        requestId,
        userId,
        surveyId: args.surveyId,
        outcome: "error",
      })
      throw err
    }
  },
})

/**
 * Remove a blob and any photo row pointing at it (draft or saved survey).
 * Used when the surveyor deletes or replaces a photo on review.
 */
export const releaseStorage = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    if (me.role === "pending") clientError("FORBIDDEN", "Not allowed")

    const rows = await ctx.db
      .query("photos")
      .withIndex("by_storageId", (q) => q.eq("storageId", args.storageId))
      .collect()

    if (rows.length === 0) return

    // Sequential — never clientError inside Promise.all (sibling UPR → isolate restart).
    const surveysBefore = new Map<string, Doc<"surveys">>()
    for (const row of rows) {
      const survey = await ctx.db.get(row.surveyId)
      if (!survey) {
        await ctx.db.delete(row._id)
        continue
      }
      await assertCanAccessSurvey(ctx, me, survey)
      if (survey.qcStatus === "approved" && me.role === "surveyor") {
        clientError("LOCKED", "Survey is locked")
      }
      surveysBefore.set(row.surveyId, survey)
      await ctx.db.delete(row._id)
    }

    await deleteStorageIfPresent(ctx, args.storageId)

    await writeAudit(ctx, {
      actorId: me._id,
      action: "photo.released",
      entity: "storage",
      entityId: args.storageId,
    })

    for (const survey of surveysBefore.values()) {
      await refreshSurveyCompletionPct(ctx, survey)
    }
  },
})

export const removeBySurveySlot = mutation({
  args: {
    surveyId: v.id("surveys"),
    slot: photoSlot,
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const survey = await ctx.db.get(args.surveyId)
    if (!survey) return
    await assertCanAccessSurvey(ctx, me, survey)
    if (survey.qcStatus === "approved" && me.role === "surveyor") {
      clientError("LOCKED", "Survey is locked")
    }

    const slotRows = await ctx.db
      .query("photos")
      .withIndex("by_survey_slot", (q) => q.eq("surveyId", args.surveyId).eq("slot", args.slot))
      .take(4)
    if (slotRows.length === 0) return

    for (const row of slotRows) {
      await deleteStorageIfPresent(ctx, row.storageId)
      await ctx.db.delete(row._id)
    }

    await writeAudit(ctx, {
      actorId: me._id,
      action: "photo.removed",
      entity: "survey",
      entityId: args.surveyId,
      metadata: { slot: args.slot },
    })
    await refreshSurveyCompletionPct(ctx, survey)
  },
})

export const remove = mutation({
  args: { id: v.id("photos") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const photo = await ctx.db.get(args.id)
    if (!photo) return
    const survey = await ctx.db.get(photo.surveyId)
    if (!survey) return
    await assertCanAccessSurvey(ctx, me, survey)
    if (survey.qcStatus === "approved" && me.role === "surveyor") {
      clientError("LOCKED", "Survey is locked")
    }
    await deleteStorageIfPresent(ctx, photo.storageId)
    await ctx.db.delete(args.id)
    await refreshSurveyCompletionPct(ctx, survey)
  },
})
