/**
 * Full survey export (all mobile fields + floors + photos) and Excel re-import.
 */
import type { Doc, Id } from "../_generated/dataModel"
import type { QueryCtx } from "../_generated/server"
import { MAX_EXPORT_FLOORS_PER_SURVEY, MAX_EXPORT_PHOTOS_PER_SURVEY } from "../lib/budgetLimits"
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
    Promise.all(muniIdSet.map((id) => ctx.db.get(id))),
    Promise.all(districtIdSet.map((id) => ctx.db.get(id))),
    Promise.all(surveyorIdSet.map((id) => ctx.db.get(id))),
  ])

  const muniMap = mapTruthyById(munis)
  const districtMap = mapTruthyById(districts)
  const surveyorMap = mapTruthyById(surveyors)

  const bundles = await Promise.all(
    enriched.map(async (survey) => {
      const [floorRows, photoRows] = await Promise.all([
        ctx.db
          .query("floors")
          .withIndex("by_survey", (q) => q.eq("surveyId", survey._id))
          .take(MAX_EXPORT_FLOORS_PER_SURVEY),
        ctx.db
          .query("photos")
          .withIndex("by_survey", (q) => q.eq("surveyId", survey._id))
          .take(MAX_EXPORT_PHOTOS_PER_SURVEY),
      ])

      const photos = await Promise.all(
        photoRows.map(async (p) => ({
          slot: p.slot,
          sizeKb: p.sizeKb,
          width: p.width,
          height: p.height,
          capturedAt: p.capturedAt,
          // Skip storage URL resolution unless requested — up to 640 syscalls per page.
          url: includePhotoUrls ? await ctx.storage.getUrl(p.storageId) : null,
        }))
      )

      const muni = muniMap.get(survey.municipalityId)
      const district = districtMap.get(survey.districtId)
      const surveyor = surveyorMap.get(survey.surveyorId)

      return {
        ...survey,
        districtName: district?.name ?? "",
        municipalityName: muni?.name ?? survey.city,
        municipalityCode: muni?.code ?? "",
        surveyorName: surveyor?.name ?? "",
        surveyorEmail: surveyor?.email ?? "",
        floors: floorRows.sort((a, b) => a.position - b.position).map(presentFloorRow),
        photos,
      }
    })
  )

  return bundles
}

export { loadMunicipalityCodes }
