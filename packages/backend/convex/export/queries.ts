import { v } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import type { QueryCtx } from "../_generated/server"
import { query } from "../_generated/server"
import { comparePropertyIds } from "../lib/propertyId"
import { gpsCapture, photoSlot, qcStatus, sanitationType, surveyOwnerEntry, surveyStatus, waterSource } from "../schema"
import { hasCapability } from "../shared/capabilities"
import { assertCanAccessSurvey, fieldSurveyAccess } from "../shared/fieldAccess"
import { clientError, requireUser } from "../shared/helpers"
import {
  assertMunicipalityInScope,
  resolveTenantScope,
  tenantDistrictIds,
  tenantMunicipalityIds,
} from "../shared/tenancy"
import { collectSurveysForListPaginated } from "../surveys/helpers"
import { enrichSurveysForExport, loadMunicipalityCodes } from "./helpers"

const listFilterArgs = {
  status: v.optional(surveyStatus),
  qcStatus: v.optional(qcStatus),
  wardNo: v.optional(v.string()),
  districtId: v.optional(v.id("districts")),
  municipalityId: v.optional(v.id("municipalities")),
  surveyorId: v.optional(v.id("users")),
}

const exportPhotoValidator = v.object({
  slot: photoSlot,
  sizeKb: v.number(),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  capturedAt: v.number(),
  url: v.union(v.string(), v.null()),
})

const exportFloorValidator = v.object({
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

/** Full survey row + labels + child rows returned to the Excel exporter. */
const exportBundleValidator = v.object({
  _id: v.id("surveys"),
  _creationTime: v.number(),
  localId: v.string(),
  surveyorId: v.id("users"),
  districtId: v.id("districts"),
  municipalityId: v.id("municipalities"),
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
  waterSource,
  sanitationType,
  municipalWasteCollection: v.boolean(),
  electricityNo: v.optional(v.string()),
  gps: v.optional(gpsCapture),
  districtName: v.string(),
  municipalityName: v.string(),
  municipalityCode: v.string(),
  surveyorName: v.string(),
  surveyorEmail: v.string(),
  floors: v.array(exportFloorValidator),
  photos: v.array(exportPhotoValidator),
})

const EXPORT_SCOPE_LIMIT = 5000
const DEFAULT_EXPORT_PAGE_SIZE = 30
const MAX_EXPORT_PAGE_SIZE = 50

type ExportListFilters = {
  status?: Doc<"surveys">["status"]
  qcStatus?: Doc<"surveys">["qcStatus"]
  wardNo?: string
  districtId?: Id<"districts">
  municipalityId?: Id<"municipalities">
  surveyorId?: Id<"users">
}

type FieldAccess = Awaited<ReturnType<typeof fieldSurveyAccess>>

async function requireExportCaller(ctx: QueryCtx) {
  const me = await requireUser(ctx)
  const [access, canExport] = await Promise.all([fieldSurveyAccess(ctx, me), hasCapability(ctx, me, "reports.export")])
  if (access === "none" || (!canExport && access !== "own")) {
    clientError("FORBIDDEN", "You don't have permission for this action.")
  }
  return { me, access }
}

/** One full-scope collect + propertyId sort for Excel export (IDs or offset pages). */
async function collectSortedExportSurveys(
  ctx: QueryCtx,
  me: Doc<"users">,
  access: FieldAccess,
  args: ExportListFilters
): Promise<Doc<"surveys">[]> {
  const scope = await resolveTenantScope(ctx, me)
  const districtIds = tenantDistrictIds(scope)
  const muniIds = tenantMunicipalityIds(scope)

  if (args.municipalityId) {
    await assertMunicipalityInScope(ctx, me, args.municipalityId)
  }
  if (args.districtId && access !== "admin" && !districtIds.has(args.districtId)) {
    clientError("FORBIDDEN", "This district is outside your assigned scope")
  }

  const listArgs = {
    qcStatus: args.qcStatus,
    wardNo: args.wardNo,
    districtId: args.districtId,
    municipalityId: args.municipalityId,
    surveyorId: args.surveyorId,
    ...(access !== "assigned" && args.status ? { status: args.status } : {}),
  }

  const rows = await collectSurveysForListPaginated(ctx, me, listArgs, scope, muniIds, access, EXPORT_SCOPE_LIMIT)
  rows.sort((a, b) => comparePropertyIds(a.propertyId, b.propertyId))
  return rows
}

/**
 * Phase 1 of fast Excel export: scan scope once and return sorted survey IDs.
 * Clients then call getExportBundlesByIds in chunks (no re-scan).
 */
export const listExportIds = query({
  args: { ...listFilterArgs },
  returns: v.object({
    surveyIds: v.array(v.id("surveys")),
    total: v.number(),
  }),
  handler: async (ctx, args) => {
    const { me, access } = await requireExportCaller(ctx)
    const rows = await collectSortedExportSurveys(ctx, me, access, args)
    return {
      surveyIds: rows.map((r) => r._id),
      total: rows.length,
    }
  },
})

/**
 * Phase 2 of fast Excel export: enrich a small ID page (floors/photos/labels).
 * Cap matches MAX_EXPORT_PAGE_SIZE so reads stay under Convex limits.
 */
export const getExportBundlesByIds = query({
  args: {
    surveyIds: v.array(v.id("surveys")),
  },
  returns: v.object({
    bundles: v.array(exportBundleValidator),
  }),
  handler: async (ctx, args) => {
    const { me } = await requireExportCaller(ctx)
    const ids = args.surveyIds.slice(0, MAX_EXPORT_PAGE_SIZE)
    if (ids.length === 0) {
      return { bundles: [] }
    }

    const loaded = await Promise.all(ids.map((id) => ctx.db.get(id)))
    const surveys = loaded.filter((survey): survey is Doc<"surveys"> => survey !== null)
    await Promise.all(surveys.map((survey) => assertCanAccessSurvey(ctx, me, survey)))

    const codes = await loadMunicipalityCodes(
      ctx,
      surveys.map((r) => r.municipalityId)
    )
    const bundles = await enrichSurveysForExport(ctx, surveys, codes)
    return { bundles }
  },
})

/** Same filters as survey.list; paginate with offset/pageSize to stay under read limits. */
export const listForExport = query({
  args: {
    ...listFilterArgs,
    offset: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  returns: v.object({
    bundles: v.array(exportBundleValidator),
    total: v.number(),
    nextOffset: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, args) => {
    const { me, access } = await requireExportCaller(ctx)
    const offset = Math.max(args.offset ?? 0, 0)
    const pageSize = Math.min(Math.max(args.pageSize ?? DEFAULT_EXPORT_PAGE_SIZE, 1), MAX_EXPORT_PAGE_SIZE)

    const rows = await collectSortedExportSurveys(ctx, me, access, args)
    const total = rows.length
    const page = rows.slice(offset, offset + pageSize)
    const codes = await loadMunicipalityCodes(
      ctx,
      page.map((r) => r.municipalityId)
    )
    const bundles = await enrichSurveysForExport(ctx, page, codes)
    const nextOffset = offset + pageSize < total ? offset + pageSize : null

    return { bundles, total, nextOffset }
  },
})
