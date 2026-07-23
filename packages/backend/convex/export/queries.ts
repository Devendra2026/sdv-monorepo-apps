import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import type { QueryCtx } from "../_generated/server"
import { query } from "../_generated/server"
import {
  DEFAULT_EXPORT_PAGE_SIZE,
  EXPORT_ID_PAGE_SIZE,
  EXPORT_SCOPE_LIMIT,
  MAX_EXPORT_ID_PAGE_SIZE,
  MAX_EXPORT_PAGE_SIZE,
} from "../lib/budgetLimits"
import { logBudgetEvent, logSlowPath } from "../lib/observability"
import { comparePropertyIds } from "../lib/propertyId"
import { getLegacyWardStatsRow } from "../lib/surveyAnalyticsLookups"
import { resolveListTotalFromStats, scopeStatsFastPathEligible } from "../lib/surveyScopeStats"
import { pendingQcCount } from "../lib/surveyStatsAggregate"
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
import {
  applySurveyListFilters,
  collectSurveysForListPaginated,
  listPaginatedUsesIndexedCursor,
  paginateMunicipalitySurveys,
} from "../surveys/helpers"
import { enrichSurveysForExport, loadMunicipalityCodes } from "./helpers"

export {
  DEFAULT_EXPORT_PAGE_SIZE,
  EXPORT_ID_PAGE_SIZE,
  EXPORT_SCOPE_LIMIT,
  MAX_EXPORT_ID_PAGE_SIZE,
  MAX_EXPORT_PAGE_SIZE,
}

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

async function resolveExportTotal(ctx: QueryCtx, me: Doc<"users">, args: ExportListFilters): Promise<number | null> {
  // nowMs only affects daily "today" fields; export total uses lifetime rollups.
  const nowMs = 0
  if (scopeStatsFastPathEligible(args)) {
    return await resolveListTotalFromStats(ctx, me, nowMs, {
      districtId: args.districtId,
      municipalityId: args.municipalityId,
      status: args.status,
      qcStatus: args.qcStatus,
    })
  }
  if (args.wardNo && args.municipalityId && !args.status && !args.qcStatus && !args.surveyorId) {
    const row = await getLegacyWardStatsRow(ctx, args.municipalityId, args.wardNo)
    return row?.total ?? null
  }
  if (args.wardNo && args.municipalityId && args.qcStatus === "approved" && !args.surveyorId) {
    const row = await getLegacyWardStatsRow(ctx, args.municipalityId, args.wardNo)
    return row?.qcApproved ?? null
  }
  if (args.wardNo && args.municipalityId && args.qcStatus === "pending" && !args.surveyorId) {
    const row = await getLegacyWardStatsRow(ctx, args.municipalityId, args.wardNo)
    if (!row) return null
    return pendingQcCount(row.submitted, row.qcApproved, row.qcPending)
  }
  return null
}

/** One full-scope collect + propertyId sort for multi-ULB / district Excel fallback. */
async function collectSortedExportSurveys(
  ctx: QueryCtx,
  me: Doc<"users">,
  access: FieldAccess,
  args: ExportListFilters
): Promise<Doc<"surveys">[]> {
  const scope = await resolveTenantScope(ctx, me)
  const muniIds = tenantMunicipalityIds(scope)

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
 * Phase 1 of Excel export: cursor page of survey IDs for the current scope.
 * Single-ULB / ward scopes use indexed Convex pagination (no 800 hard cap).
 * Broader scopes fall back to a capped collect (truncated=true when capped).
 */
export const listExportIds = query({
  args: {
    ...listFilterArgs,
    paginationOpts: v.optional(paginationOptsValidator),
  },
  returns: v.object({
    surveyIds: v.array(v.id("surveys")),
    continueCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
    total: v.number(),
    truncated: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const { me, access } = await requireExportCaller(ctx)
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

    // Ward export must be ULB-scoped so we can walk the full ward index (e.g. 1500 rows).
    if (args.wardNo && !args.municipalityId) {
      clientError(
        "VALIDATION",
        "Select a ULB (municipality) before exporting by ward — full ward downloads are not available for district-only scope."
      )
    }

    const numItems = Math.min(
      Math.max(args.paginationOpts?.numItems ?? EXPORT_ID_PAGE_SIZE, 1),
      MAX_EXPORT_ID_PAGE_SIZE
    )
    const statsTotal = await resolveExportTotal(ctx, me, listArgs)

    if (listPaginatedUsesIndexedCursor(listArgs) && args.municipalityId) {
      // Fill a full ID page even when ACL / secondary filters thin some rows.
      const surveyIds: Id<"surveys">[] = []
      let cursor = args.paginationOpts?.cursor ?? null
      let isDone = false
      let fillGuard = 0
      while (surveyIds.length < numItems && !isDone && fillGuard < 30) {
        fillGuard += 1
        const indexed = await paginateMunicipalitySurveys(ctx, {
          municipalityId: args.municipalityId,
          status: listArgs.status,
          qcStatus: listArgs.qcStatus,
          wardNo: listArgs.wardNo,
          paginationOpts: {
            numItems: Math.max(numItems - surveyIds.length, 1),
            cursor,
          },
        })
        const filtered = applySurveyListFilters(indexed.page, listArgs, me, muniIds)
        for (const row of filtered) {
          surveyIds.push(row._id)
          if (surveyIds.length >= numItems) break
        }
        cursor = indexed.continueCursor
        isDone = indexed.isDone
        if (indexed.page.length === 0) break
      }
      return {
        surveyIds,
        continueCursor: isDone ? null : cursor,
        isDone,
        total: statsTotal ?? surveyIds.length,
        truncated: false,
      }
    }

    // Multi-ULB / district / surveyor: single capped collect, one page.
    const rows = await collectSortedExportSurveys(ctx, me, access, listArgs)
    const truncated = rows.length >= EXPORT_SCOPE_LIMIT
    return {
      surveyIds: rows.map((r) => r._id),
      continueCursor: null,
      isDone: true,
      total: rows.length,
      truncated,
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
    /** When true, resolve Convex storage URLs for photos (expensive). Default false. */
    includePhotoUrls: v.optional(v.boolean()),
  },
  returns: v.object({
    bundles: v.array(exportBundleValidator),
  }),
  handler: async (ctx, args) => {
    const startedAt = Date.now()
    const { me } = await requireExportCaller(ctx)
    if (args.surveyIds.length > MAX_EXPORT_PAGE_SIZE) {
      logBudgetEvent("export.getExportBundlesByIds.over_limit", {
        requested: args.surveyIds.length,
        max: MAX_EXPORT_PAGE_SIZE,
      })
      clientError(
        "VALIDATION",
        `Export page is limited to ${MAX_EXPORT_PAGE_SIZE} surveys per request — split into smaller chunks`
      )
    }
    const ids = args.surveyIds
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
    const bundles = await enrichSurveysForExport(ctx, surveys, codes, {
      includePhotoUrls: args.includePhotoUrls === true,
    })
    if (bundles.length !== ids.length) {
      // Missing docs are expected if IDs were deleted mid-export; never silently drop by page size.
      logBudgetEvent("export.getExportBundlesByIds.partial", {
        requested: ids.length,
        returned: bundles.length,
      })
    }
    logSlowPath("export.getExportBundlesByIds", startedAt, {
      surveyCount: ids.length,
      bundleCount: bundles.length,
      includePhotoUrls: args.includePhotoUrls === true,
    })
    return { bundles }
  },
})

/** Legacy path removed — rescanned full export scope on every page (OOM risk).
 * Use listExportIds + getExportBundlesByIds instead.
 */
export const listForExport = query({
  args: {
    ...listFilterArgs,
    offset: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    includePhotoUrls: v.optional(v.boolean()),
  },
  returns: v.object({
    bundles: v.array(exportBundleValidator),
    total: v.number(),
    nextOffset: v.union(v.number(), v.null()),
  }),
  handler: async () => {
    clientError("VALIDATION", "listForExport is disabled — use listExportIds then getExportBundlesByIds in chunks")
  },
})
