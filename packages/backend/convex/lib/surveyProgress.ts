import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { recordSurveyStatsUpdate } from "./surveyScopeStats";

/** Rough completion % for list rows (mirrors client `lib/survey/progress.ts`). */
export function computeSurveyCompletionPercent(input: {
  propertyId?: string;
  wardNo?: string;
  parcelNo?: string;
  respondentName?: string;
  mobileNo?: string;
  locality?: string;
  ownershipType?: string;
  propertyUse?: string;
  plotSqft?: number;
  gps?: unknown;
  floors?: unknown[];
  photos?: unknown[];
}): number {
  const checks = [
    !!input.propertyId?.trim(),
    !!input.wardNo?.trim(),
    !!input.parcelNo?.trim(),
    !!input.respondentName?.trim(),
    !!input.mobileNo?.trim(),
    !!input.locality?.trim(),
    !!input.ownershipType?.trim(),
    !!input.propertyUse?.trim(),
    (input.plotSqft ?? 0) > 0,
    (input.floors?.length ?? 0) > 0,
    !!input.gps,
    (input.photos?.length ?? 0) >= 1,
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

export async function completionPctForSurvey(ctx: MutationCtx, survey: Doc<"surveys">): Promise<number> {
  // Presence-only: take(1) avoids loading every floor/photo on hot draft saves.
  const [floors, photos] = await Promise.all([
    ctx.db
      .query("floors")
      .withIndex("by_survey", (q) => q.eq("surveyId", survey._id))
      .take(1),
    ctx.db
      .query("photos")
      .withIndex("by_survey", (q) => q.eq("surveyId", survey._id))
      .take(1),
  ]);
  return computeSurveyCompletionPercent({
    ...survey,
    floors,
    photos,
  });
}

/**
 * Recompute completionPct from related rows, patch the survey, and maintain
 * analytics rollups with the mutation's before snapshot.
 */
export async function refreshSurveyCompletionPct(ctx: MutationCtx, before: Doc<"surveys">): Promise<void> {
  const current = await ctx.db.get("surveys", before._id);
  if (!current) return;
  const pct = await completionPctForSurvey(ctx, current);
  if (pct !== current.completionPct) {
    await ctx.db.patch(before._id, { completionPct: pct });
  }
  const after: Doc<"surveys"> = pct !== current.completionPct ? { ...current, completionPct: pct } : current;
  await recordSurveyStatsUpdate(ctx, before, after);
}
