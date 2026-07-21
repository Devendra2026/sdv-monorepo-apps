import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { normalizeWardNo } from "./qcWardStats"

/** Sentinel: legacy rows omit the generation field and use pre-migration indexes. */
export const LEGACY_GENERATION = "legacy"

export type AnalyticsGeneration = string

/** Max rows per legacy index key (legacy + active + building generations). */
const LEGACY_INDEX_MATCH_CAP = 16

type DbCtx = QueryCtx | MutationCtx

type GenerationTagged = { generation?: string }

/** True when a rollup row is pre-cutover legacy (generation field omitted). */
export function isLegacyAnalyticsRow(row: GenerationTagged): boolean {
  return row.generation === undefined
}

/** Pick the sole legacy row from mixed-generation legacy-index matches. */
export function pickUniqueLegacyRow<T extends GenerationTagged>(rows: Iterable<T>, context: string): T | null {
  let match: T | null = null
  for (const row of rows) {
    if (!isLegacyAnalyticsRow(row)) continue
    if (match) {
      throw new Error(`Multiple legacy analytics rows for ${context}`)
    }
    match = row
  }
  return match
}

/** Keep only legacy rows from a legacy-index page (range scans, ward/surveyor lists). */
export function filterLegacyAnalyticsRows<T extends GenerationTagged>(rows: Iterable<T>): T[] {
  return [...rows].filter(isLegacyAnalyticsRow)
}

export function isLegacyGeneration(generation: AnalyticsGeneration): boolean {
  return generation === LEGACY_GENERATION
}

export async function getLegacyMunicipalityStatsRow(
  ctx: DbCtx,
  municipalityId: Id<"municipalities">
): Promise<Doc<"surveyMunicipalityStats"> | null> {
  const rows = await ctx.db
    .query("surveyMunicipalityStats")
    .withIndex("by_municipality", (q) => q.eq("municipalityId", municipalityId))
    .take(LEGACY_INDEX_MATCH_CAP)
  return pickUniqueLegacyRow(rows, `municipality ${municipalityId}`)
}

export async function getLegacyDailyStatsRow(
  ctx: DbCtx,
  municipalityId: Id<"municipalities">,
  dateKey: string
): Promise<Doc<"surveyDailyStats"> | null> {
  const rows = await ctx.db
    .query("surveyDailyStats")
    .withIndex("by_municipality_date", (q) => q.eq("municipalityId", municipalityId).eq("dateKey", dateKey))
    .take(LEGACY_INDEX_MATCH_CAP)
  return pickUniqueLegacyRow(rows, `municipality ${municipalityId} date ${dateKey}`)
}

export async function getLegacyWardStatsRow(
  ctx: DbCtx,
  municipalityId: Id<"municipalities">,
  wardNo: string
): Promise<Doc<"surveyWardStats"> | null> {
  const normalized = normalizeWardNo(wardNo)
  const rows = await ctx.db
    .query("surveyWardStats")
    .withIndex("by_municipality_ward", (q) => q.eq("municipalityId", municipalityId).eq("wardNo", normalized))
    .take(LEGACY_INDEX_MATCH_CAP)
  return pickUniqueLegacyRow(rows, `municipality ${municipalityId} ward ${normalized}`)
}

export async function getLegacySurveyorStatsRow(
  ctx: DbCtx,
  surveyorId: Id<"users">,
  municipalityId: Id<"municipalities">
): Promise<Doc<"surveySurveyorStats"> | null> {
  const rows = await ctx.db
    .query("surveySurveyorStats")
    .withIndex("by_surveyor_municipality", (q) =>
      q.eq("surveyorId", surveyorId).eq("municipalityId", municipalityId)
    )
    .take(LEGACY_INDEX_MATCH_CAP)
  return pickUniqueLegacyRow(rows, `surveyor ${surveyorId} municipality ${municipalityId}`)
}

export async function getMunicipalityStatsRowForGeneration(
  ctx: DbCtx,
  generation: AnalyticsGeneration,
  municipalityId: Id<"municipalities">
): Promise<Doc<"surveyMunicipalityStats"> | null> {
  if (isLegacyGeneration(generation)) {
    return getLegacyMunicipalityStatsRow(ctx, municipalityId)
  }
  return await ctx.db
    .query("surveyMunicipalityStats")
    .withIndex("by_generation_and_municipalityId", (q) =>
      q.eq("generation", generation).eq("municipalityId", municipalityId)
    )
    .unique()
}

export async function getDailyStatsRowForGeneration(
  ctx: DbCtx,
  generation: AnalyticsGeneration,
  municipalityId: Id<"municipalities">,
  dateKey: string
): Promise<Doc<"surveyDailyStats"> | null> {
  if (isLegacyGeneration(generation)) {
    return getLegacyDailyStatsRow(ctx, municipalityId, dateKey)
  }
  return await ctx.db
    .query("surveyDailyStats")
    .withIndex("by_generation_and_municipalityId_and_dateKey", (q) =>
      q.eq("generation", generation).eq("municipalityId", municipalityId).eq("dateKey", dateKey)
    )
    .unique()
}

export async function getWardStatsRowForGeneration(
  ctx: DbCtx,
  generation: AnalyticsGeneration,
  municipalityId: Id<"municipalities">,
  wardNo: string
): Promise<Doc<"surveyWardStats"> | null> {
  if (isLegacyGeneration(generation)) {
    return getLegacyWardStatsRow(ctx, municipalityId, wardNo)
  }
  const normalized = normalizeWardNo(wardNo)
  return await ctx.db
    .query("surveyWardStats")
    .withIndex("by_generation_and_municipalityId_and_wardNo", (q) =>
      q.eq("generation", generation).eq("municipalityId", municipalityId).eq("wardNo", normalized)
    )
    .unique()
}

export async function getSurveyorStatsRowForGeneration(
  ctx: DbCtx,
  generation: AnalyticsGeneration,
  surveyorId: Id<"users">,
  municipalityId: Id<"municipalities">
): Promise<Doc<"surveySurveyorStats"> | null> {
  if (isLegacyGeneration(generation)) {
    return getLegacySurveyorStatsRow(ctx, surveyorId, municipalityId)
  }
  return await ctx.db
    .query("surveySurveyorStats")
    .withIndex("by_generation_and_surveyorId_and_municipalityId", (q) =>
      q.eq("generation", generation).eq("surveyorId", surveyorId).eq("municipalityId", municipalityId)
    )
    .unique()
}
