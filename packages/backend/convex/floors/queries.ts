/**
 * Floors live in their own table because they're 1:N to a survey and the
 * client can add/remove/reorder them independently of the parent rows.
 *
 * Idempotency: `clientFloorId` is the key. The mobile generates it once
 * and resends on every save — duplicate sends update in place.
 */
import { v } from "convex/values";
import { query } from "../_generated/server";
import { presentFloorRow } from "../lib/masters/areaMasters";
import { assertCanAccessSurvey } from "../shared/fieldAccess";
import { clientError, requireUser } from "../shared/helpers";

/** Matches max QC table page size (`QC_TABLE_PAGE_SIZE_OPTIONS`). */
const MAX_SURVEYS_PER_FLOOR_LIST = 5000;

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
});

export const list = query({
  args: { surveyId: v.id("surveys") },
  returns: v.array(floorRowValidator),
  handler: async (ctx, args) => {
    const [me, survey] = await Promise.all([requireUser(ctx), ctx.db.get(args.surveyId)]);
    if (!survey) return [];
    await assertCanAccessSurvey(ctx, me, survey);
    const rows = await ctx.db
      .query("floors")
      .withIndex("by_survey", (q) => q.eq("surveyId", args.surveyId))
      .collect();
    return rows.sort((a, b) => a.position - b.position).map(presentFloorRow);
  },
});

export const listForSurveys = query({
  args: {
    surveyIds: v.array(v.id("surveys")),
  },
  returns: v.array(
    v.object({
      surveyId: v.id("surveys"),
      floors: v.array(floorRowValidator),
    }),
  ),
  handler: async (ctx, args) => {
    if (args.surveyIds.length > MAX_SURVEYS_PER_FLOOR_LIST) {
      clientError("VALIDATION", `A maximum of ${MAX_SURVEYS_PER_FLOOR_LIST} surveys can be requested at once`);
    }
    const me = await requireUser(ctx);
    const uniqueSurveyIds = [...new Set(args.surveyIds)];
    const grouped = await Promise.all(
      uniqueSurveyIds.map(async (surveyId) => {
        const survey = await ctx.db.get(surveyId);
        if (!survey) {
          return { surveyId, floors: [] };
        }
        try {
          await assertCanAccessSurvey(ctx, me, survey);
        } catch {
          return { surveyId, floors: [] };
        }
        const rows = await ctx.db
          .query("floors")
          .withIndex("by_survey", (q) => q.eq("surveyId", surveyId))
          .collect();
        return {
          surveyId,
          floors: rows.sort((a, b) => a.position - b.position).map(presentFloorRow),
        };
      }),
    );

    return grouped;
  },
});
