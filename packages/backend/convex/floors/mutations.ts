import { v } from "convex/values"
import { mutation } from "../_generated/server"
import {
  normalizeFloorFields,
  plinthSqftFromFloors,
  usageTypeToOccupied,
  validateFloorRow,
} from "../lib/masters/areaMasters"
import { splitKeeperAndDuplicates } from "../lib/safeUnique"
import { refreshSurveyCompletionPct } from "../lib/surveyProgress"
import { assertCanAccessSurvey } from "../shared/fieldAccess"
import { clientError, requireUser, writeAudit } from "../shared/helpers"
import { assertSurveyWritable } from "../surveys/helpers"

export const upsert = mutation({
  args: {
    surveyId: v.id("surveys"),
    clientFloorId: v.string(),
    position: v.number(),
    floorName: v.string(),
    usageFactor: v.optional(v.string()),
    usageType: v.string(),
    constructionType: v.string(),
    isOccupied: v.boolean(),
    areaSqft: v.number(),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const survey = await ctx.db.get(args.surveyId)
    if (!survey) clientError("NOT_FOUND", "Survey not found")
    await assertCanAccessSurvey(ctx, me, survey)
    await assertSurveyWritable(ctx, me, survey)

    const normalized = normalizeFloorFields({
      usageFactor: args.usageFactor,
      usageType: args.usageType,
    })

    const floorErrors = validateFloorRow({
      floorName: args.floorName,
      usageFactor: normalized.usageFactor || undefined,
      usageType: normalized.usageType,
      constructionType: args.constructionType,
      areaSqft: args.areaSqft,
    })
    if (Object.keys(floorErrors).length > 0) {
      clientError("VALIDATION", "Invalid floor row", floorErrors)
    }
    const isOccupied = usageTypeToOccupied(normalized.usageType)

    // Never .unique() — concurrent upserts can create duplicate clientFloorId rows.
    const floorRowsForId = await ctx.db
      .query("floors")
      .withIndex("by_survey_clientFloorId", (q) =>
        q.eq("surveyId", args.surveyId).eq("clientFloorId", args.clientFloorId)
      )
      .take(4)
    const { keeper: existing, duplicates } = splitKeeperAndDuplicates(floorRowsForId, "oldest")
    for (const dup of duplicates) {
      await ctx.db.delete(dup._id)
    }

    const row = {
      position: args.position,
      floorName: args.floorName,
      usageFactor: normalized.usageFactor || undefined,
      usageType: normalized.usageType,
      constructionType: args.constructionType,
      isOccupied,
      areaSqft: args.areaSqft,
    }

    let floorId = existing?._id
    if (existing) {
      await ctx.db.patch(existing._id, row)
    } else {
      floorId = await ctx.db.insert("floors", {
        surveyId: args.surveyId,
        clientFloorId: args.clientFloorId,
        ...row,
      })
      await writeAudit(ctx, {
        actorId: me._id,
        action: "floor.added",
        entity: "survey",
        entityId: args.surveyId,
        metadata: { clientFloorId: args.clientFloorId },
      })
    }

    const floorRows = await ctx.db
      .query("floors")
      .withIndex("by_survey", (q) => q.eq("surveyId", args.surveyId))
      .collect()
    await ctx.db.patch(args.surveyId, {
      plinthSqft: plinthSqftFromFloors(floorRows),
      serverVersion: survey.serverVersion + 1,
    })
    await refreshSurveyCompletionPct(ctx, survey)

    return floorId!
  },
})

/** Drop server floor rows whose client ids are no longer in the local draft. */
export const removeOrphans = mutation({
  args: {
    surveyId: v.id("surveys"),
    keepClientFloorIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const survey = await ctx.db.get(args.surveyId)
    if (!survey) clientError("NOT_FOUND", "Survey not found")
    await assertCanAccessSurvey(ctx, me, survey)
    await assertSurveyWritable(ctx, me, survey)
    const keep = new Set(args.keepClientFloorIds)
    const rows = await ctx.db
      .query("floors")
      .withIndex("by_survey", (q) => q.eq("surveyId", args.surveyId))
      .collect()
    for (const row of rows) {
      if (!keep.has(row.clientFloorId)) await ctx.db.delete(row._id)
    }
    const floorRows = await ctx.db
      .query("floors")
      .withIndex("by_survey", (q) => q.eq("surveyId", args.surveyId))
      .collect()
    await ctx.db.patch(args.surveyId, {
      plinthSqft: plinthSqftFromFloors(floorRows),
      serverVersion: survey.serverVersion + 1,
    })
    await refreshSurveyCompletionPct(ctx, survey)
  },
})

export const remove = mutation({
  args: { id: v.id("floors") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const floor = await ctx.db.get(args.id)
    if (!floor) return
    const survey = await ctx.db.get(floor.surveyId)
    if (!survey) return
    await assertCanAccessSurvey(ctx, me, survey)
    await assertSurveyWritable(ctx, me, survey)
    await ctx.db.delete(args.id)
    const floorRows = await ctx.db
      .query("floors")
      .withIndex("by_survey", (q) => q.eq("surveyId", floor.surveyId))
      .collect()
    await ctx.db.patch(floor.surveyId, {
      plinthSqft: plinthSqftFromFloors(floorRows),
      serverVersion: survey.serverVersion + 1,
    })
    await refreshSurveyCompletionPct(ctx, survey)
  },
})

/**
 * Bulk reorder — used by drag-and-drop on the floors editor. Skips the
 * audit entry since per-floor mutations would create noise.
 */
export const reorder = mutation({
  args: {
    surveyId: v.id("surveys"),
    order: v.array(v.object({ id: v.id("floors"), position: v.number() })),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const survey = await ctx.db.get(args.surveyId)
    if (!survey) clientError("NOT_FOUND", "Survey not found")
    await assertCanAccessSurvey(ctx, me, survey)
    await assertSurveyWritable(ctx, me, survey)
    for (const o of args.order) {
      const f = await ctx.db.get(o.id)
      if (!f || f.surveyId !== args.surveyId) continue
      await ctx.db.patch(o.id, { position: o.position })
    }
  },
})
