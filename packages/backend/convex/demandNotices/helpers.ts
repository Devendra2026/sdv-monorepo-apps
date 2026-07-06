import { v } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import type { QueryCtx } from "../_generated/server"
import {
  CONSTRUCTION_TYPES,
  FLOOR_NAMES,
  FLOOR_USAGE_FACTORS,
  FLOOR_USAGE_TYPES,
  presentFloorRow,
} from "../lib/masters/areaMasters"
import {
  mergeMasterOptions,
  SANITATION_TYPES,
  WATER_SOURCES,
} from "../lib/masters/serviceMasters"
import {
  OWNERSHIP_TYPES,
  PROPERTY_USE_SUBCATEGORIES,
  PROPERTY_USES,
  PROPERTY_USES_REQUIRING_SUBCATEGORY,
  ROAD_TYPES,
  SITUATIONS,
  TAX_RATE_ZONES,
} from "../lib/masters/taxationMasters"
import { loadActiveMastersByCategories } from "../lib/mastersLoad"
import { buildDemandNoticeDocumentProps, type DemandNoticeMastersBundle } from "../lib/qc/buildDemandNoticeDocument"
import type { DemandNoticeDocumentProps } from "../lib/qc/demandNoticeDocumentTypes"
import { normalizeStoredTaxRates } from "../lib/qc/normalizeTaxRates"
import { clientError, requireUser } from "../shared/helpers"
import { assertCanAccessSurvey } from "../shared/fieldAccess"

export const MAX_EXPORT_SURVEYS = 5000

export const jobStatusValidator = v.union(
  v.literal("queued"),
  v.literal("rendering"),
  v.literal("uploading"),
  v.literal("completed"),
  v.literal("failed")
)

export const exportJobValidator = v.object({
  _id: v.id("demandNoticeExportJobs"),
  status: jobStatusValidator,
  processedCount: v.number(),
  totalCount: v.number(),
  filename: v.string(),
  errorMessage: v.union(v.string(), v.null()),
  downloadUrl: v.union(v.string(), v.null()),
})

const MASTER_BUNDLE_CATEGORIES = [
  "assessment_year",
  "ownership_type",
  "property_use",
  "situation",
  "road_type",
  "tax_rate_zone",
  "water_source",
  "sanitation_type",
  "usage_factor",
  "usage_type",
  "floor_usage_type",
  "construction_type",
  "floor_name",
] as const

type MastersBundle = DemandNoticeMastersBundle

export function assertJobAccess(
  me: Awaited<ReturnType<typeof requireUser>>,
  job: { requestedBy: Id<"users"> } | null
) {
  if (!job) clientError("NOT_FOUND", "Export job not found")
  if (job.requestedBy !== me._id && me.role !== "admin") {
    clientError("FORBIDDEN", "You do not have access to this export job")
  }
}

async function loadMastersBundle(ctx: QueryCtx, municipalityId: Id<"municipalities">): Promise<MastersBundle> {
  const categorySet = new Set<string>(MASTER_BUNDLE_CATEGORIES)
  const rows = (await loadActiveMastersByCategories(ctx, MASTER_BUNDLE_CATEGORIES)).filter((m) =>
    categorySet.has(m.category)
  )
  rows.sort((a, b) => a.category.localeCompare(b.category) || a.position - b.position)

  const grouped: Record<string, Array<{ value: string; label: string }>> = {}
  for (const row of rows) {
    if (!grouped[row.category]) grouped[row.category] = []
    grouped[row.category]!.push({ value: row.value, label: row.label })
  }

  const muni = await ctx.db.get(municipalityId)
  const district = muni ? await ctx.db.get(muni.districtId) : null

  return {
    updatedAt: Date.now(),
    districts: district
      ? [
          {
            _id: district._id,
            name: district.name,
            stateName: district.stateName,
          },
        ]
      : [],
    ulbs: muni
      ? [
          {
            _id: muni._id,
            code: muni.code,
            name: muni.name,
            bodyType: muni.bodyType,
            districtId: muni.districtId,
            stateName: district?.stateName ?? "Uttar Pradesh",
          },
        ]
      : [],
    wards: [],
    tenantScope: null,
    assessmentYears: grouped["assessment_year"] ?? [],
    ownershipTypes: grouped["ownership_type"]?.length ? grouped["ownership_type"]! : OWNERSHIP_TYPES,
    propertyUses: (grouped["property_use"]?.length ? grouped["property_use"]! : PROPERTY_USES).filter(
      (o) => o.value !== "agricultural_land"
    ),
    propertyUseSubcategories: PROPERTY_USE_SUBCATEGORIES,
    propertyUsesRequiringSubcategory: PROPERTY_USES_REQUIRING_SUBCATEGORY,
    situations: grouped["situation"]?.length ? grouped["situation"]! : SITUATIONS,
    roadTypes: grouped["road_type"]?.length ? grouped["road_type"]! : ROAD_TYPES,
    taxRateZones: grouped["tax_rate_zone"]?.length ? grouped["tax_rate_zone"]! : TAX_RATE_ZONES,
    relationships: [],
    waterSources: mergeMasterOptions(WATER_SOURCES, grouped["water_source"]),
    sanitationTypes: mergeMasterOptions(SANITATION_TYPES, grouped["sanitation_type"]),
    usageFactors: grouped["usage_factor"]?.length
      ? grouped["usage_factor"]!
      : grouped["usage_type"]?.length
        ? grouped["usage_type"]!
        : FLOOR_USAGE_FACTORS,
    usageTypes: grouped["floor_usage_type"]?.length ? grouped["floor_usage_type"]! : FLOOR_USAGE_TYPES,
    constructionTypes: grouped["construction_type"]?.length ? grouped["construction_type"]! : CONSTRUCTION_TYPES,
    floors: mergeMasterOptions(FLOOR_NAMES, grouped["floor_name"]),
  } as MastersBundle
}

async function loadTaxRates(ctx: QueryCtx, municipalityId: Id<"municipalities">) {
  const doc = await ctx.db
    .query("taxRates")
    .withIndex("by_municipality", (q) => q.eq("municipalityId", municipalityId))
    .unique()
  return doc ? normalizeStoredTaxRates(doc) : null
}

async function loadPhotoUrls(ctx: QueryCtx, surveyId: Id<"surveys">) {
  const [front, side] = await Promise.all(
    (["front", "side"] as const).map((slot) =>
      ctx.db
        .query("photos")
        .withIndex("by_survey_slot", (q) => q.eq("surveyId", surveyId).eq("slot", slot))
        .unique()
    )
  )
  return {
    front: front ? await ctx.storage.getUrl(front.storageId) : null,
    side: side ? await ctx.storage.getUrl(side.storageId) : null,
  }
}

async function loadFloors(ctx: QueryCtx, surveyId: Id<"surveys">) {
  const rows = await ctx.db
    .query("floors")
    .withIndex("by_survey", (q) => q.eq("surveyId", surveyId))
    .collect()
  return rows.sort((a, b) => a.position - b.position).map(presentFloorRow)
}

export async function buildNoticePayloadsForSurveys(
  ctx: QueryCtx,
  me: Doc<"users">,
  args: {
    surveyIds: Id<"surveys">[]
    municipalityId: Id<"municipalities">
    reportDateMs: number
  }
): Promise<DemandNoticeDocumentProps[]> {
  const [masters, rateConfig, muni] = await Promise.all([
    loadMastersBundle(ctx, args.municipalityId),
    loadTaxRates(ctx, args.municipalityId),
    ctx.db.get(args.municipalityId),
  ])

  const signatureUrl = muni?.executiveSignatureStorageId
    ? await ctx.storage.getUrl(muni.executiveSignatureStorageId)
    : null

  const payloads = await Promise.all(
    args.surveyIds.map(async (surveyId) => {
      const survey = await ctx.db.get(surveyId)
      if (!survey) return null
      await assertCanAccessSurvey(ctx, me, survey)

      const [floors, photoUrls] = await Promise.all([loadFloors(ctx, surveyId), loadPhotoUrls(ctx, surveyId)])

      return buildDemandNoticeDocumentProps(
        survey,
        floors,
        masters,
        rateConfig,
        args.reportDateMs,
        photoUrls,
        signatureUrl
      )
    })
  )

  return payloads.filter((payload): payload is DemandNoticeDocumentProps => payload !== null)
}
