/**
 * ETL extract queries — called only via HTTP actions with X-ETL-Secret.
 * Do not expose these as public client APIs.
 */
import { paginationOptsValidator } from "convex/server"
import { v, type Infer } from "convex/values"
import type { Id } from "../_generated/dataModel"
import { internalQuery } from "../_generated/server"
import {
  EXPORT_ENRICH_CONCURRENCY,
  MAX_EXPORT_FLOORS_PER_SURVEY,
  MAX_EXPORT_PHOTOS_PER_SURVEY,
} from "../lib/budgetLimits"
import { mapPool } from "../lib/mapPool"
import { presentFloorRow } from "../lib/masters/areaMasters"
import { gpsCapture, photoSlot, qcStatus, surveyOwnerEntry, surveyStatus } from "../schema"

const MAX_ETL_BUNDLE_IDS = 50
const DEFAULT_ETL_PAGE = 100
const MAX_ETL_PAGE = 200

type EtlSurveyStatus = Infer<typeof surveyStatus>

const SURVEY_STATUS_VALUES = [
  "draft",
  "submitted",
  "approved",
  "rejected",
] as const satisfies readonly EtlSurveyStatus[]

/** Fails to compile if `surveyStatus` gains a literal that is not listed above. */
type _EveryStatusListed = Exclude<EtlSurveyStatus, (typeof SURVEY_STATUS_VALUES)[number]> extends never ? true : never
const _everyStatusListed: _EveryStatusListed = true
void _everyStatusListed

/**
 * Statuses the downstream ETL imports into Postgres.
 *
 * Includes drafts: Nest stores them as DRAFT and fills missing ward /
 * assessment-year with placeholders so incomplete field captures still land.
 */
export const ETL_MIGRATABLE_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "rejected",
] as const satisfies readonly EtlSurveyStatus[]

/** Drops unknown values so a stale caller cannot trip ArgumentValidationError. */
export function sanitizeStatuses(raw: unknown): EtlSurveyStatus[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const known = raw.filter((value): value is EtlSurveyStatus =>
    (SURVEY_STATUS_VALUES as readonly string[]).includes(value as string)
  )
  return known.length > 0 ? [...new Set(known)] : undefined
}

const etlPhotoValidator = v.object({
  slot: photoSlot,
  storageId: v.id("_storage"),
  sizeKb: v.number(),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  capturedAt: v.number(),
  url: v.union(v.string(), v.null()),
})

const etlFloorValidator = v.object({
  _id: v.id("floors"),
  clientFloorId: v.string(),
  position: v.number(),
  floorName: v.string(),
  usageFactor: v.optional(v.string()),
  usageType: v.string(),
  constructionType: v.string(),
  isOccupied: v.boolean(),
  areaSqft: v.number(),
})

const etlBundleValidator = v.object({
  _id: v.id("surveys"),
  _creationTime: v.number(),
  localId: v.string(),
  surveyorId: v.id("users"),
  surveyorClerkId: v.union(v.string(), v.null()),
  surveyorEmail: v.union(v.string(), v.null()),
  surveyorName: v.union(v.string(), v.null()),
  districtId: v.id("districts"),
  districtCode: v.string(),
  districtName: v.string(),
  municipalityId: v.id("municipalities"),
  municipalityCode: v.string(),
  municipalityName: v.string(),
  wardNo: v.string(),
  status: surveyStatus,
  qcStatus,
  serverVersion: v.number(),
  clientUpdatedAt: v.number(),
  submittedAt: v.optional(v.number()),
  completionPct: v.optional(v.number()),
  sectorNo: v.optional(v.string()),
  oldPropertyNo: v.optional(v.string()),
  propertyId: v.optional(v.string()),
  parcelNo: v.string(),
  unitNo: v.string(),
  constructedYear: v.optional(v.number()),
  isSlum: v.boolean(),
  respondentName: v.optional(v.string()),
  relationship: v.optional(v.string()),
  owners: v.optional(v.array(surveyOwnerEntry)),
  familySize: v.optional(v.number()),
  mobileNo: v.string(),
  altMobileNo: v.optional(v.string()),
  houseNo: v.optional(v.string()),
  locality: v.string(),
  colonyName: v.string(),
  city: v.string(),
  pinCode: v.string(),
  assessmentYear: v.string(),
  ownershipType: v.string(),
  propertyType: v.string(),
  propertyUse: v.string(),
  situation: v.string(),
  roadType: v.string(),
  taxRateZone: v.string(),
  plotSqft: v.number(),
  plinthSqft: v.number(),
  municipalWaterConnection: v.boolean(),
  waterSource: v.string(),
  sanitationType: v.string(),
  municipalWasteCollection: v.boolean(),
  electricityNo: v.optional(v.string()),
  gps: v.optional(gpsCapture),
  floors: v.array(etlFloorValidator),
  photos: v.array(etlPhotoValidator),
})

export const listSurveyIds = internalQuery({
  args: {
    paginationOpts: paginationOptsValidator,
    /** Retained so a not-yet-redeployed caller keeps working. */
    status: v.optional(surveyStatus),
    statuses: v.optional(v.array(surveyStatus)),
  },
  returns: v.object({
    ids: v.array(v.id("surveys")),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const numItems = Math.min(Math.max(1, args.paginationOpts.numItems || DEFAULT_ETL_PAGE), MAX_ETL_PAGE)
    const page = await ctx.db
      .query("surveys")
      .order("asc")
      .paginate({ ...args.paginationOpts, numItems })

    // Filtering after the page is drawn keeps the cursor contract intact: a page
    // may come back empty while `isDone` is false, and the caller must keep going.
    const wanted = args.statuses?.length
      ? new Set<EtlSurveyStatus>(args.statuses)
      : args.status
        ? new Set<EtlSurveyStatus>([args.status])
        : null

    const ids = wanted ? page.page.filter((s) => wanted.has(s.status)).map((s) => s._id) : page.page.map((s) => s._id)

    return {
      ids,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    }
  },
})

export const countSurveys = internalQuery({
  args: {},
  returns: v.object({ count: v.number() }),
  handler: async (ctx) => {
    // Convex allows only one .paginate() per query — return first-page estimate is wrong.
    // Prefer countSurveysHttp which fans out via sequential runQuery pages.
    const page = await ctx.db.query("surveys").order("asc").paginate({
      numItems: 1,
      cursor: null,
    })
    // Signal "unknown / use http action" — keep validator happy for callers that still use this.
    // Real total is computed in countSurveysHttp.
    void page
    return { count: -1 }
  },
})

export const getSurveyBundles = internalQuery({
  args: {
    // Accept strings so HTTP can filter non-survey IDs without ArgumentValidationError
    ids: v.array(v.string()),
  },
  returns: v.object({
    bundles: v.array(etlBundleValidator),
    skippedIds: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    if (args.ids.length > MAX_ETL_BUNDLE_IDS) {
      throw new Error(`ETL bundle request exceeds max of ${MAX_ETL_BUNDLE_IDS}`)
    }

    const skippedIds: string[] = []
    const surveyIds: Id<"surveys">[] = []
    for (const raw of args.ids) {
      const id = ctx.db.normalizeId("surveys", raw)
      if (!id) {
        skippedIds.push(raw)
        continue
      }
      surveyIds.push(id)
    }

    const surveys = await mapPool(surveyIds, EXPORT_ENRICH_CONCURRENCY, (id) => ctx.db.get(id))
    const present = surveys.filter((s): s is NonNullable<typeof s> => s != null)

    const districtIds = [...new Set(present.map((s) => s.districtId))]
    const muniIds = [...new Set(present.map((s) => s.municipalityId))]
    const surveyorIds = [...new Set(present.map((s) => s.surveyorId))]

    const [districts, munis, surveyors] = await Promise.all([
      mapPool(districtIds, EXPORT_ENRICH_CONCURRENCY, (id) => ctx.db.get(id)),
      mapPool(muniIds, EXPORT_ENRICH_CONCURRENCY, (id) => ctx.db.get(id)),
      mapPool(surveyorIds, EXPORT_ENRICH_CONCURRENCY, (id) => ctx.db.get(id)),
    ])

    const districtMap = new Map(districts.filter((d): d is NonNullable<typeof d> => d != null).map((d) => [d._id, d]))
    const muniMap = new Map(munis.filter((m): m is NonNullable<typeof m> => m != null).map((m) => [m._id, m]))
    const surveyorMap = new Map(surveyors.filter((u): u is NonNullable<typeof u> => u != null).map((u) => [u._id, u]))

    const bundles = await mapPool(present, EXPORT_ENRICH_CONCURRENCY, async (survey) => {
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

      const photos = await mapPool(photoRows, EXPORT_ENRICH_CONCURRENCY, async (p) => ({
        slot: p.slot,
        storageId: p.storageId,
        sizeKb: p.sizeKb,
        width: p.width,
        height: p.height,
        capturedAt: p.capturedAt,
        url: await ctx.storage.getUrl(p.storageId),
      }))

      const district = districtMap.get(survey.districtId)
      const muni = muniMap.get(survey.municipalityId)
      const surveyor = surveyorMap.get(survey.surveyorId)

      return {
        _id: survey._id,
        _creationTime: survey._creationTime,
        localId: survey.localId,
        surveyorId: survey.surveyorId,
        surveyorClerkId: surveyor?.clerkId ?? null,
        surveyorEmail: surveyor?.email ?? null,
        surveyorName: surveyor?.name ?? null,
        districtId: survey.districtId,
        districtCode: district?.code ?? "",
        districtName: district?.name ?? "",
        municipalityId: survey.municipalityId,
        municipalityCode: muni?.code ?? "",
        municipalityName: muni?.name ?? "",
        wardNo: survey.wardNo,
        status: survey.status,
        qcStatus: survey.qcStatus,
        serverVersion: survey.serverVersion,
        clientUpdatedAt: survey.clientUpdatedAt,
        submittedAt: survey.submittedAt,
        completionPct: survey.completionPct,
        sectorNo: survey.sectorNo,
        oldPropertyNo: survey.oldPropertyNo,
        propertyId: survey.propertyId,
        parcelNo: survey.parcelNo,
        unitNo: survey.unitNo,
        constructedYear: survey.constructedYear,
        isSlum: survey.isSlum,
        respondentName: survey.respondentName,
        relationship: survey.relationship,
        owners: survey.owners,
        familySize: survey.familySize,
        mobileNo: survey.mobileNo,
        altMobileNo: survey.altMobileNo,
        houseNo: survey.houseNo,
        locality: survey.locality,
        colonyName: survey.colonyName,
        city: survey.city,
        pinCode: survey.pinCode,
        assessmentYear: survey.assessmentYear,
        ownershipType: survey.ownershipType,
        propertyType: survey.propertyType,
        propertyUse: survey.propertyUse,
        situation: survey.situation,
        roadType: survey.roadType,
        taxRateZone: survey.taxRateZone,
        plotSqft: survey.plotSqft,
        plinthSqft: survey.plinthSqft,
        municipalWaterConnection: survey.municipalWaterConnection,
        waterSource: survey.waterSource,
        sanitationType: survey.sanitationType,
        municipalWasteCollection: survey.municipalWasteCollection,
        electricityNo: survey.electricityNo,
        gps: survey.gps,
        floors: floorRows
          .sort((a, b) => a.position - b.position)
          .map((f) => {
            const presented = presentFloorRow(f)
            return {
              _id: presented._id,
              clientFloorId: presented.clientFloorId,
              position: presented.position,
              floorName: presented.floorName,
              usageFactor: presented.usageFactor,
              usageType: presented.usageType,
              constructionType: presented.constructionType,
              isOccupied: presented.isOccupied,
              areaSqft: presented.areaSqft,
            }
          }),
        photos,
      }
    })

    return { bundles, skippedIds }
  },
})

/** Full ward catalog for Nest sync (Convex is canonical). */
export const listWardCatalog = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      municipalityCode: v.string(),
      municipalityName: v.string(),
      wardNo: v.string(),
      wardCode: v.string(),
      wardName: v.string(),
    })
  ),
  handler: async (ctx) => {
    const municipalities = await ctx.db.query("municipalities").collect()
    const wards = await ctx.db.query("wards").collect()
    const byMuni = new Map(municipalities.map((m) => [m._id, m]))
    const rows: Array<{
      municipalityCode: string
      municipalityName: string
      wardNo: string
      wardCode: string
      wardName: string
    }> = []
    for (const ward of wards) {
      const muni = byMuni.get(ward.municipalityId)
      if (!muni) continue
      rows.push({
        municipalityCode: muni.code,
        municipalityName: muni.name,
        wardNo: ward.wardNo,
        wardCode: ward.wardCode,
        wardName: ward.name,
      })
    }
    rows.sort((a, b) => {
      const c = a.municipalityCode.localeCompare(b.municipalityCode)
      if (c !== 0) return c
      return a.wardNo.localeCompare(b.wardNo, undefined, { numeric: true })
    })
    return rows
  },
})

export { DEFAULT_ETL_PAGE, MAX_ETL_BUNDLE_IDS, MAX_ETL_PAGE }
