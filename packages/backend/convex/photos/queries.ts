/**
 * Photo upload flow with Convex storage.
 *
 *  1. mobile: `generateUploadUrl` → returns a short-lived signed POST URL
 *  2. mobile: POSTs the compressed image bytes to that URL → gets a storageId back
 *  3. mobile: `linkPhoto({ surveyId, slot, storageId, ... })` → registers it
 *
 * Storage cleanup: deleting a photo also removes the underlying blob.
 * Convex garbage-collects orphaned blobs lazily; we delete proactively
 * to avoid stale references.
 */
import { v } from "convex/values"
import { query } from "../_generated/server"
import { MAX_DEMAND_NOTICE_PAYLOAD_PAGE, NOTICE_PHOTO_URL_CONCURRENCY } from "../lib/budgetLimits"
import { mapPool } from "../lib/mapPool"
import { assertCanAccessSurvey } from "../shared/fieldAccess"
import { clientError, requireUser } from "../shared/helpers"

/** Signed preview URLs — only for blobs linked to accessible surveys. */
export const resolveStorageUrls = query({
  args: {
    storageIds: v.array(v.id("_storage")),
    surveyId: v.optional(v.id("surveys")),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    if (me.role === "pending") return []

    if (args.storageIds.length > 50) {
      clientError("VALIDATION", "Storage URL resolution is limited to 50 ids per request")
    }

    const unique = [...new Set(args.storageIds)]
    return Promise.all(
      unique.map(async (storageId) => {
        const photo = await ctx.db
          .query("photos")
          .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
          .first()

        if (!photo) {
          return { storageId, url: null }
        }

        const survey = await ctx.db.get(photo.surveyId)
        if (!survey) return { storageId, url: null }
        try {
          await assertCanAccessSurvey(ctx, me, survey)
        } catch {
          return { storageId, url: null }
        }
        return { storageId, url: await ctx.storage.getUrl(storageId) }
      })
    )
  },
})

/** Front + side photo URLs for demand notice export (batch, page-sized). */
export const noticePhotoUrls = query({
  args: { surveyIds: v.array(v.id("surveys")) },
  returns: v.record(
    v.string(),
    v.object({
      front: v.union(v.string(), v.null()),
      side: v.union(v.string(), v.null()),
    })
  ),
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    if (me.role === "pending") return {}

    if (args.surveyIds.length > MAX_DEMAND_NOTICE_PAYLOAD_PAGE) {
      clientError(
        "VALIDATION",
        `Notice photo URLs are limited to ${MAX_DEMAND_NOTICE_PAYLOAD_PAGE} surveys per request`
      )
    }

    const ids = args.surveyIds
    const entries = await mapPool(ids, NOTICE_PHOTO_URL_CONCURRENCY, async (surveyId) => {
      const survey = await ctx.db.get(surveyId)
      if (!survey) {
        return [surveyId, { front: null, side: null }] as const
      }
      try {
        await assertCanAccessSurvey(ctx, me, survey)
      } catch {
        return [surveyId, { front: null, side: null }] as const
      }

      // Never .unique() — concurrent linkPhoto races can leave duplicate slot rows.
      const [front, side] = await Promise.all(
        (["front", "side"] as const).map(async (slot) => {
          const rows = await ctx.db
            .query("photos")
            .withIndex("by_survey_slot", (q) => q.eq("surveyId", surveyId).eq("slot", slot))
            .take(2)
          return rows.reduce<(typeof rows)[number] | null>(
            (best, row) => (!best || row._creationTime >= best._creationTime ? row : best),
            null
          )
        })
      )

      return [
        surveyId,
        {
          front: front ? await ctx.storage.getUrl(front.storageId) : null,
          side: side ? await ctx.storage.getUrl(side.storageId) : null,
        },
      ] as const
    })

    return Object.fromEntries(entries)
  },
})

/** Front-photo preview URLs for survey list tables (batch, max 50 ids). */
export const frontThumbnails = query({
  args: { surveyIds: v.array(v.id("surveys")) },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    if (me.role === "pending") return {}

    const ids = args.surveyIds.slice(0, 50)
    const entries = await Promise.all(
      ids.map(async (surveyId) => {
        const survey = await ctx.db.get(surveyId)
        if (!survey) {
          return [surveyId, null] as const
        }
        try {
          await assertCanAccessSurvey(ctx, me, survey)
        } catch {
          return [surveyId, null] as const
        }

        const frontRows = await ctx.db
          .query("photos")
          .withIndex("by_survey_slot", (q) => q.eq("surveyId", surveyId).eq("slot", "front"))
          .take(2)
        const front = frontRows.reduce<(typeof frontRows)[number] | null>(
          (best, row) => (!best || row._creationTime >= best._creationTime ? row : best),
          null
        )
        return [surveyId, front ? await ctx.storage.getUrl(front.storageId) : null] as const
      })
    )

    return Object.fromEntries(entries)
  },
})

export const list = query({
  args: { surveyId: v.id("surveys") },
  handler: async (ctx, args) => {
    const [me, survey] = await Promise.all([requireUser(ctx), ctx.db.get(args.surveyId)])
    if (!survey) return []
    await assertCanAccessSurvey(ctx, me, survey)

    const rows = await ctx.db
      .query("photos")
      .withIndex("by_survey", (q) => q.eq("surveyId", args.surveyId))
      .collect()
    return rows.map((p) => ({
      _id: p._id,
      surveyId: p.surveyId,
      slot: p.slot,
      storageId: p.storageId,
      sizeKb: p.sizeKb,
      width: p.width,
      height: p.height,
      capturedAt: p.capturedAt,
      uploadedBy: p.uploadedBy,
    }))
  },
})

/** Resolve signed storage URLs for photos the client is ready to display. */
export const getUrls = query({
  args: { photoIds: v.array(v.id("photos")) },
  handler: async (ctx, args) => {
    if (args.photoIds.length === 0) return {}
    if (args.photoIds.length > 50) {
      clientError("VALIDATION", "Photo URL resolution is limited to 50 ids per request")
    }

    const me = await requireUser(ctx)
    const entries = await Promise.all(
      args.photoIds.map(async (photoId) => {
        const photo = await ctx.db.get(photoId)
        if (!photo) return [photoId, null] as const
        const survey = await ctx.db.get(photo.surveyId)
        if (!survey) return [photoId, null] as const
        try {
          await assertCanAccessSurvey(ctx, me, survey)
        } catch {
          return [photoId, null] as const
        }
        return [photoId, await ctx.storage.getUrl(photo.storageId)] as const
      })
    )

    return Object.fromEntries(entries) as Record<string, string | null>
  },
})
