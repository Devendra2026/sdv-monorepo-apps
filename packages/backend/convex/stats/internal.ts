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
  clearAllRollupStats,
  createBackfillAggregates,
  flushBackfillAggregates,
  mergeSurveyIntoBackfillAggregates,
} from "../lib/surveyRollupStats"

const DEFAULT_BATCH_SIZE = 200

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

    if (args.reset && !args.cursor) {
      await clearAllRollupStats(ctx)
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
