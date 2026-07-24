/**
 * Full survey export (all mobile fields + floors + photos) and Excel re-import.
 */
import type { Doc, Id } from "../_generated/dataModel"
import type { QueryCtx } from "../_generated/server"
import {
  EXPORT_ENRICH_CONCURRENCY,
  MAX_EXPORT_FLOORS_PER_SURVEY,
  MAX_EXPORT_PHOTOS_PER_SURVEY,
} from "../lib/budgetLimits"
import { mapPool } from "../lib/mapPool"
import { presentFloorRow } from "../lib/masters/areaMasters"
import { mapTruthyById } from "../shared/helpers"
import { enrichSurveyPropertyIds, loadMunicipalityCodes } from "../surveys/helpers"

export function registerPropertyIdMapping(
  map: Map<string, Id<"surveys">>,
  surveyId: Id<"surveys">,
  ...ids: (string | undefined)[]
): void {
  for (const id of ids) {
    const key = id?.trim().toUpperCase()
    if (key) map.set(key, surveyId)
  }
}

/** Prefer latest approve decision; otherwise latest decision by decidedAt. */
function pickLatestQcDecision(decisions: Doc<"qcDecisions">[]): Doc<"qcDecisions"> | null {
  if (decisions.length === 0) return null
  const approved = decisions.filter((d) => d.decision === "approve")
  const pool = approved.length > 0 ? approved : decisions
  return pool.reduce((best, row) => (row.decidedAt > best.decidedAt ? row : best))
}

export async function enrichSurveysForExport(
  ctx: QueryCtx,
  surveys: Doc<"surveys">[],
  codes: Map<Id<"municipalities">, string>,
  options?: { includePhotoUrls?: boolean }
) {
  if (surveys.length === 0) {
    return []
  }

  const includePhotoUrls = options?.includePhotoUrls === true
  const enriched = enrichSurveyPropertyIds(surveys, codes)

  const muniIdSet = [...new Set(enriched.map((r) => r.municipalityId))]
  const districtIdSet = [...new Set(enriched.map((r) => r.districtId))]
  const surveyorIdSet = [...new Set(enriched.map((r) => r.surveyorId))]

  const [munis, districts, surveyors] = await Promise.all([
    mapPool(muniIdSet, EXPORT_ENRICH_CONCURRENCY, (id) => ctx.db.get(id)),
    mapPool(districtIdSet, EXPORT_ENRICH_CONCURRENCY, (id) => ctx.db.get(id)),
    mapPool(surveyorIdSet, EXPORT_ENRICH_CONCURRENCY, (id) => ctx.db.get(id)),
  ])

  const muniMap = mapTruthyById(munis)
  const districtMap = mapTruthyById(districts)
  const surveyorMap = mapTruthyById(surveyors)

  return mapPool(enriched, EXPORT_ENRICH_CONCURRENCY, async (survey) => {
    const [floorRows, photoRows, qcDecisions] = await Promise.all([
      ctx.db
        .query("floors")
        .withIndex("by_survey", (q) => q.eq("surveyId", survey._id))
        .take(MAX_EXPORT_FLOORS_PER_SURVEY),
      ctx.db
        .query("photos")
        .withIndex("by_survey", (q) => q.eq("surveyId", survey._id))
        .take(MAX_EXPORT_PHOTOS_PER_SURVEY),
      ctx.db
        .query("qcDecisions")
        .withIndex("by_survey", (q) => q.eq("surveyId", survey._id))
        .collect(),
    ])

    const photos = includePhotoUrls
      ? await mapPool(photoRows, EXPORT_ENRICH_CONCURRENCY, async (p) => ({
          slot: p.slot,
          sizeKb: p.sizeKb,
          width: p.width,
          height: p.height,
          capturedAt: p.capturedAt,
          url: await ctx.storage.getUrl(p.storageId),
        }))
      : photoRows.map((p) => ({
          slot: p.slot,
          sizeKb: p.sizeKb,
          width: p.width,
          height: p.height,
          capturedAt: p.capturedAt,
          url: null as string | null,
        }))

    const muni = muniMap.get(survey.municipalityId)
    const district = districtMap.get(survey.districtId)
    const surveyor = surveyorMap.get(survey.surveyorId)
    const latestDecision = pickLatestQcDecision(qcDecisions)
    const reviewer = latestDecision ? await ctx.db.get(latestDecision.reviewerId) : null
    const qcApprovedByName = latestDecision?.decision === "approve" ? (reviewer?.name ?? reviewer?.email ?? "") : ""
    const qcDecidedAt = latestDecision?.decidedAt

    return {
      ...survey,
      districtName: district?.name ?? "",
      municipalityName: muni?.name ?? survey.city,
      municipalityCode: muni?.code ?? "",
      surveyorName: surveyor?.name ?? "",
      surveyorEmail: surveyor?.email ?? "",
      qcApprovedByName,
      qcDecidedAt,
      floors: floorRows.sort((a, b) => a.position - b.position).map(presentFloorRow),
      photos,
    }
  })
}

export { loadMunicipalityCodes }
