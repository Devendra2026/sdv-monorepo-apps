/**
 * Batched backfill for denormalized survey rollup tables.
 * Run once after deploy via Convex dashboard:
 *   internal.stats.internal.backfillSurveyRollups({ reset: true })
 *   internal.stats.internal.backfillQcDecisionMunicipalities({})
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

const DEFAULT_BATCH_SIZE = 200

const rollupClearTable = v.union(
  v.literal("surveyMunicipalityStats"),
  v.literal("surveyDailyStats"),
  v.literal("surveyWardStats"),
  v.literal("surveySurveyorStats"),
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
