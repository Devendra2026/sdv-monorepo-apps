/**
 * Floors live in their own table because they're 1:N to a survey and the
 * client can add/remove/reorder them independently of the parent rows.
 *
 * Idempotency: `clientFloorId` is the key. The mobile generates it once
 * and resends on every save — duplicate sends update in place.
 */
import { v } from "convex/values"
import { query } from "../_generated/server"
import { MAX_EXPORT_FLOORS_PER_SURVEY } from "../lib/budgetLimits"
import { mapPool } from "../lib/mapPool"
import { presentFloorRow } from "../lib/masters/areaMasters"
import { assertCanAccessSurvey } from "../shared/fieldAccess"
import { clientError, requireUser } from "../shared/helpers"

/**
 * Demand-register / QC tables pass one page of survey IDs.
 * Before: 5000 — unbounded parallel floor collects could OOM self-hosted Convex.
 * After: 100 — covers largest table page sizes with headroom.
 */
const MAX_SURVEYS_PER_FLOOR_LIST = 100
/** Cap parallel floor queries to avoid Postgres/query-stream stampede. */
const FLOOR_LIST_CONCURRENCY = 10

const floorRowValidator = v.object({
  _id: v.id("floors"),
  _creationTime: v.number(),
  surveyId: v.id("surveys"),
  clientFloorId: v.string(),
  position: v.number(),
  floorName: v.string(),
  usageFactor: v.optional(v.string()),
  usageType: v.string(),
  constructionType: v.string(),
  isOccupied: v.boolean(),
  areaSqft: v.number(),
})

export const list = query({
  args: { surveyId: v.id("surveys") },
  returns: v.array(floorRowValidator),
  handler: async (ctx, args) => {
    const [me, survey] = await Promise.all([requireUser(ctx), ctx.db.get(args.surveyId)])
    if (!survey) return []
    await assertCanAccessSurvey(ctx, me, survey)
    const rows = await ctx.db
      .query("floors")
      .withIndex("by_survey", (q) => q.eq("surveyId", args.surveyId))
      .collect()
    return rows.sort((a, b) => a.position - b.position).map(presentFloorRow)
  },
})

export const listForSurveys = query({
  args: {
    surveyIds: v.array(v.id("surveys")),
  },
  returns: v.array(
    v.object({
      surveyId: v.id("surveys"),
      floors: v.array(floorRowValidator),
    })
  ),
  handler: async (ctx, args) => {
    if (args.surveyIds.length > MAX_SURVEYS_PER_FLOOR_LIST) {
      clientError("VALIDATION", `A maximum of ${MAX_SURVEYS_PER_FLOOR_LIST} surveys can be requested at once`)
    }
    const me = await requireUser(ctx)
    const uniqueSurveyIds = [...new Set(args.surveyIds)]

    const surveys = await mapPool(uniqueSurveyIds, FLOOR_LIST_CONCURRENCY, (surveyId) => ctx.db.get(surveyId))
    const authorizedIds: Array<(typeof uniqueSurveyIds)[number]> = []

    for (let index = 0; index < uniqueSurveyIds.length; index += 1) {
      const surveyId = uniqueSurveyIds[index]!
      const survey = surveys[index]
      if (!survey) continue
      try {
        await assertCanAccessSurvey(ctx, me, survey)
        authorizedIds.push(surveyId)
      } catch {
        // Skip surveys outside the caller's scope.
      }
    }

    return mapPool(authorizedIds, FLOOR_LIST_CONCURRENCY, async (surveyId) => {
      const rows = await ctx.db
        .query("floors")
        .withIndex("by_survey", (q) => q.eq("surveyId", surveyId))
        .take(MAX_EXPORT_FLOORS_PER_SURVEY)
      return {
        surveyId,
        floors: rows.sort((a, b) => a.position - b.position).map(presentFloorRow),
      }
    })
  },
})
