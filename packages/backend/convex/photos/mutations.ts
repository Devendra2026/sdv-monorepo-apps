import { v } from "convex/values"
import type { Doc } from "../_generated/dataModel"
import { mutation } from "../_generated/server"
import { refreshSurveyCompletionPct } from "../lib/surveyProgress"
import { hasCapability } from "../shared/capabilities"
import { assertCanAccessSurvey } from "../shared/fieldAccess"
import { clientError, requireUser, writeAudit } from "../shared/helpers"
import { photoSlot } from "../schema"
import { assertSurveyWritable } from "../surveys/helpers"
import { deleteStorageIfPresent } from "./helpers"

/** Returns a one-time upload URL. Valid for ~1 hour by Convex defaults. */
export const generateUploadUrl = mutation({
  args: { surveyId: v.id("surveys") },
  handler: async (ctx, args) => {
    const [me, survey] = await Promise.all([requireUser(ctx), ctx.db.get(args.surveyId)])
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
 *  - the storage id exists
 *  - the survey is owned by / readable by the caller
 *  - size is sane (≤ 1 MB after the mobile's compression)
 *  - one photo per slot — re-linking the same slot replaces the previous photo
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
    const [me, survey] = await Promise.all([requireUser(ctx), ctx.db.get(args.surveyId)])
    if (!survey) {
      await deleteStorageIfPresent(ctx, args.storageId)
      clientError("NOT_FOUND", "Survey not found")
    }
    await assertCanAccessSurvey(ctx, me, survey)
    try {
      await assertSurveyWritable(ctx, me, survey)
    } catch {
      await deleteStorageIfPresent(ctx, args.storageId)
      clientError("LOCKED", "Survey is locked — you cannot upload photos in its current state")
    }
    const canUpload =
      (await hasCapability(ctx, me, "surveys.uploadPhotos")) || (await hasCapability(ctx, me, "qc.review"))
    if (!canUpload) {
      await deleteStorageIfPresent(ctx, args.storageId)
      clientError("FORBIDDEN", "You don't have permission to upload photos")
    }
    if (args.sizeKb <= 0 || args.sizeKb > 1024) {
      await deleteStorageIfPresent(ctx, args.storageId)
      clientError("VALIDATION", "Photo size out of range (≤ 1 MB)")
    }

    const existing = await ctx.db
      .query("photos")
      .withIndex("by_survey_slot", (q) => q.eq("surveyId", args.surveyId).eq("slot", args.slot))
      .unique()
    if (existing) {
      if (existing.storageId === args.storageId) {
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
    return id
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

    const surveysBefore = new Map<string, Doc<"surveys">>()
    await Promise.all(
      rows.map(async (row) => {
        const survey = await ctx.db.get(row.surveyId)
        if (!survey) {
          await ctx.db.delete(row._id)
          return
        }
        await assertCanAccessSurvey(ctx, me, survey)
        if (survey.qcStatus === "approved" && me.role === "surveyor") {
          clientError("LOCKED", "Survey is locked")
        }
        surveysBefore.set(row.surveyId, survey)
        await ctx.db.delete(row._id)
      })
    )

    await deleteStorageIfPresent(ctx, args.storageId)

    await writeAudit(ctx, {
      actorId: me._id,
      action: "photo.released",
      entity: "storage",
      entityId: args.storageId,
    })

    await Promise.all(
      [...surveysBefore.values()].map((survey) => refreshSurveyCompletionPct(ctx, survey))
    )
  },
})

export const removeBySurveySlot = mutation({
  args: {
    surveyId: v.id("surveys"),
    slot: photoSlot,
  },
  handler: async (ctx, args) => {
    const [me, survey] = await Promise.all([requireUser(ctx), ctx.db.get(args.surveyId)])
    if (!survey) return
    await assertCanAccessSurvey(ctx, me, survey)
    if (survey.qcStatus === "approved" && me.role === "surveyor") {
      clientError("LOCKED", "Survey is locked")
    }

    const existing = await ctx.db
      .query("photos")
      .withIndex("by_survey_slot", (q) => q.eq("surveyId", args.surveyId).eq("slot", args.slot))
      .unique()
    if (!existing) return

    await deleteStorageIfPresent(ctx, existing.storageId)
    await Promise.all([
      ctx.db.delete(existing._id),
      writeAudit(ctx, {
        actorId: me._id,
        action: "photo.removed",
        entity: "survey",
        entityId: args.surveyId,
        metadata: { slot: args.slot },
      }),
    ])
    await refreshSurveyCompletionPct(ctx, survey)
  },
})

export const remove = mutation({
  args: { id: v.id("photos") },
  handler: async (ctx, args) => {
    const [me, photo] = await Promise.all([requireUser(ctx), ctx.db.get(args.id)])
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
