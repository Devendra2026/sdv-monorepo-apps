/**
 * Batched backfill for denormalized survey rollup tables.
 * Run once after deploy via Convex dashboard:
 *   internal.stats.internal.backfillSurveyRollups({ reset: true })
 *   internal.stats.internal.backfillQcDecisionMunicipalities({})
 *   internal.stats.internal.reassignOrphanMunicipalitySurveys({ ... })
 */
import { v } from "convex/values"
import { internal } from "../_generated/api"
import { internalMutation } from "../_generated/server"
import {
  clearRollupStatsPage,
  createBackfillAggregates,
  flushBackfillAggregates,
  mergeSurveyIntoBackfillAggregates,
  nextRollupClearTable,
} from "../lib/surveyRollupStats"
import { recordSurveyStatsUpdate } from "../lib/surveyScopeStats"

const DEFAULT_BATCH_SIZE = 200

const rollupClearTable = v.union(
  v.literal("surveyMunicipalityStats"),
  v.literal("surveyDailyStats"),
  v.literal("surveyWardStats"),
  v.literal("surveySurveyorStats")
)

/**
 * Paginated wipe of rollup tables; when `startBackfill` is set, kicks survey backfill
 * only after every rollup table is empty (avoids clear/backfill races).
 */
export const clearRollupStatsBatch = internalMutation({
  args: {
    table: v.optional(rollupClearTable),
    startBackfill: v.optional(v.boolean()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    done: v.boolean(),
    deleted: v.number(),
    table: v.union(rollupClearTable, v.null()),
  }),
  handler: async (ctx, args) => {
    const table = args.table ?? nextRollupClearTable(null)
    if (!table) {
      if (args.startBackfill) {
        await ctx.scheduler.runAfter(0, internal.stats.internal.backfillSurveyRollups, {
          cursor: undefined,
          batchSize: args.batchSize,
          reset: false,
        })
      }
      return { done: true, deleted: 0, table: null }
    }

    const { deleted, done } = await clearRollupStatsPage(ctx, table)
    if (!done) {
      await ctx.scheduler.runAfter(0, internal.stats.internal.clearRollupStatsBatch, {
        table,
        startBackfill: args.startBackfill,
        batchSize: args.batchSize,
      })
      return { done: false, deleted, table }
    }

    const next = nextRollupClearTable(table)
    if (next) {
      await ctx.scheduler.runAfter(0, internal.stats.internal.clearRollupStatsBatch, {
        table: next,
        startBackfill: args.startBackfill,
        batchSize: args.batchSize,
      })
      return { done: false, deleted, table: next }
    }

    if (args.startBackfill) {
      await ctx.scheduler.runAfter(0, internal.stats.internal.backfillSurveyRollups, {
        cursor: undefined,
        batchSize: args.batchSize,
        reset: false,
      })
    }

    return { done: true, deleted, table: null }
  },
})

/** Full or incremental backfill of municipality / daily / ward / surveyor rollup tables. */
export const backfillSurveyRollups = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
    reset: v.optional(v.boolean()),
  },
  returns: v.object({
    done: v.boolean(),
    scanned: v.number(),
    cursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.min(args.batchSize ?? DEFAULT_BATCH_SIZE, 500)

    // Wipe via scheduler chain first; backfill starts only when clear completes.
    if (args.reset && !args.cursor) {
      await ctx.scheduler.runAfter(0, internal.stats.internal.clearRollupStatsBatch, {
        startBackfill: true,
        batchSize,
      })
      return { done: false, scanned: 0, cursor: null }
    }

    const page = await ctx.db.query("surveys").paginate({
      numItems: batchSize,
      cursor: args.cursor ?? null,
    })

    const aggregates = createBackfillAggregates()
    for (const survey of page.page) {
      mergeSurveyIntoBackfillAggregates(aggregates, survey)
    }

    await flushBackfillAggregates(ctx, aggregates, false)

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.stats.internal.backfillSurveyRollups, {
        cursor: page.continueCursor,
        batchSize,
        reset: false,
      })
    }

    return {
      done: page.isDone,
      scanned: page.page.length,
      cursor: page.isDone ? null : page.continueCursor,
    }
  },
})

/**
 * Move surveys off a deleted/missing municipality onto an active ULB.
 * Updates districtId from the target municipality, then refreshes analytics rollups.
 *
 * Example (Aminagar orphans):
 *   internal.stats.internal.reassignOrphanMunicipalitySurveys({
 *     fromMunicipalityId: "jn7…",
 *     toMunicipalityId: "jn7…",
 *   })
 */
export const reassignOrphanMunicipalitySurveys = internalMutation({
  args: {
    fromMunicipalityId: v.id("municipalities"),
    toMunicipalityId: v.id("municipalities"),
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    done: v.boolean(),
    patched: v.number(),
    scanned: v.number(),
    cursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.toMunicipalityId)
    if (!target || target.isActive === false) {
      throw new Error("Target municipality missing or inactive")
    }
    if (args.fromMunicipalityId === args.toMunicipalityId) {
      throw new Error("fromMunicipalityId and toMunicipalityId must differ")
    }

    const batchSize = Math.min(args.batchSize ?? DEFAULT_BATCH_SIZE, 200)
    const page = await ctx.db
      .query("surveys")
      .withIndex("by_municipality_status", (q) => q.eq("municipalityId", args.fromMunicipalityId))
      .paginate({ numItems: batchSize, cursor: args.cursor ?? null })

    let patched = 0
    for (const survey of page.page) {
      const before = survey
      await ctx.db.patch(survey._id, {
        municipalityId: target._id,
        districtId: target.districtId,
        serverVersion: survey.serverVersion + 1,
      })
      const after = await ctx.db.get(survey._id)
      if (after) {
        await recordSurveyStatsUpdate(ctx, before, after)
        patched += 1
      }
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.stats.internal.reassignOrphanMunicipalitySurveys, {
        fromMunicipalityId: args.fromMunicipalityId,
        toMunicipalityId: args.toMunicipalityId,
        cursor: page.continueCursor,
        batchSize,
      })
    } else {
      // Drop stale rollup rows for the deleted ULB if they still exist.
      const orphanMunicipalityStats = await ctx.db
        .query("surveyMunicipalityStats")
        .withIndex("by_municipality", (q) => q.eq("municipalityId", args.fromMunicipalityId))
        .collect()
      for (const row of orphanMunicipalityStats) {
        await ctx.db.delete(row._id)
      }
      const orphanWardStats = await ctx.db
        .query("surveyWardStats")
        .withIndex("by_municipality", (q) => q.eq("municipalityId", args.fromMunicipalityId))
        .collect()
      for (const row of orphanWardStats) {
        await ctx.db.delete(row._id)
      }
      const orphanSurveyorStats = await ctx.db
        .query("surveySurveyorStats")
        .withIndex("by_municipality", (q) => q.eq("municipalityId", args.fromMunicipalityId))
        .collect()
      for (const row of orphanSurveyorStats) {
        await ctx.db.delete(row._id)
      }
      const orphanDailyStats = await ctx.db
        .query("surveyDailyStats")
        .withIndex("by_municipality_date", (q) => q.eq("municipalityId", args.fromMunicipalityId))
        .collect()
      for (const row of orphanDailyStats) {
        await ctx.db.delete(row._id)
      }
    }

    return {
      done: page.isDone,
      patched,
      scanned: page.page.length,
      cursor: page.isDone ? null : page.continueCursor,
    }
  },
})

/** Backfill municipalityId on legacy qcDecisions rows. */
export const backfillQcDecisionMunicipalities = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    done: v.boolean(),
    patched: v.number(),
    scanned: v.number(),
    cursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const batchSize = Math.min(args.batchSize ?? DEFAULT_BATCH_SIZE, 500)
    const page = await ctx.db.query("qcDecisions").paginate({
      numItems: batchSize,
      cursor: args.cursor ?? null,
    })

    let patched = 0
    for (const decision of page.page) {
      if (decision.municipalityId) continue
      const survey = await ctx.db.get("surveys", decision.surveyId)
      if (!survey) continue
      await ctx.db.patch(decision._id, { municipalityId: survey.municipalityId })
      patched += 1
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.stats.internal.backfillQcDecisionMunicipalities, {
        cursor: page.continueCursor,
        batchSize,
      })
    }

    return {
      done: page.isDone,
      patched,
      scanned: page.page.length,
      cursor: page.isDone ? null : page.continueCursor,
    }
  },
})
