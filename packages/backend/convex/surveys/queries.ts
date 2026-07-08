import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import { query } from "../_generated/server"
import { presentFloorRow } from "../lib/masters/areaMasters"
import { normalizeParcelKey, resolvePropertyId } from "../lib/propertyId"
import { normalizeWardNo } from "../lib/qcWardStats"
import { loadScopeStatsSummary, resolveListTotalFromStats, scopeStatsFastPathEligible } from "../lib/surveyScopeStats"
import { computeSurveyWardAggregates } from "../lib/surveyWardStats"
import { qcStatus, surveyStatus } from "../schema"
import { assertCanAccessSurvey, fieldSurveyAccess, querySurveysInFieldScope } from "../shared/fieldAccess"
import { clientError, requireUser } from "../shared/helpers"
import {
  assertMunicipalityInScope,
  resolveTenantScope,
  tenantDistrictIds,
  tenantMunicipalityIds,
} from "../shared/tenancy"
import {
  COMMAND_CENTER_WARD_SCAN_LIMIT,
  LIST_PAGINATED_SCOPE_LIMIT,
  collectSurveysForListPaginated,
  enrichSurveyPropertyIds,
  enrichSurveyorNames,
  filterRowsBySearchTerm,
  loadMunicipalityCodes,
  parseListOffset,
  resolveListSort,
  sortSurveyRows,
  wardNumbersMatch,
} from "./helpers"
import {
  listFilterArgs,
  surveyCommandCenterStatsShape,
  surveyListPaginatedResultShape,
  surveyListRowValidator,
  surveySortBy,
} from "./validators"
export const list = query({
  args: {
    status: v.optional(surveyStatus),
    qcStatus: v.optional(qcStatus),
    qcStatuses: v.optional(v.array(qcStatus)),
    wardNo: v.optional(v.string()),
    districtId: v.optional(v.id("districts")),
    municipalityId: v.optional(v.id("municipalities")),
    surveyorId: v.optional(v.id("users")),
    limit: v.optional(v.number()),
    sortBy: v.optional(surveySortBy),
  },
  returns: v.array(surveyListRowValidator),
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const limit = Math.min(args.limit ?? 200, 2000)

    const scope = await resolveTenantScope(ctx, me)
    const districtIds = tenantDistrictIds(scope)
    const access = await fieldSurveyAccess(ctx, me)

    if (args.municipalityId) {
      await assertMunicipalityInScope(ctx, me, args.municipalityId)
    }
    if (args.districtId && access !== "admin" && !districtIds.has(args.districtId)) {
      clientError("FORBIDDEN", "This district is outside your assigned scope")
    }

    let rows = await querySurveysInFieldScope(ctx, me, {
      municipalityId: args.municipalityId,
      districtId: args.districtId,
      status: args.status,
      surveyorId: args.surveyorId,
      limit,
    })

    // Apply remaining filters in memory ΓÇö they're small once the index has narrowed.
    if (args.districtId) {
      rows = rows.filter((r) => r.districtId === args.districtId)
    }
    if (args.municipalityId) {
      rows = rows.filter((r) => r.municipalityId === args.municipalityId)
    }
    if (args.surveyorId) {
      rows = rows.filter((r) => r.surveyorId === args.surveyorId)
    }
    if (args.status) {
      rows = rows.filter((r) => r.status === args.status)
    }
    if (args.qcStatus) {
      rows = rows.filter((r) => r.qcStatus === args.qcStatus)
    }
    if (args.qcStatuses && args.qcStatuses.length > 0) {
      const allowed = new Set(args.qcStatuses)
      rows = rows.filter((r) => {
        if (!allowed.has(r.qcStatus)) return false
        if (r.qcStatus === "pending" && r.status !== "submitted") return false
        return true
      })
    }
    if (args.wardNo) {
      rows = rows.filter((r) => wardNumbersMatch(r.wardNo, args.wardNo!))
    }
    rows = sortSurveyRows(rows, resolveListSort(args))
    const codes = await loadMunicipalityCodes(
      ctx,
      rows.map((r) => r.municipalityId)
    )
    const enriched = enrichSurveyPropertyIds(rows, codes)
    return await enrichSurveyorNames(ctx, enriched)
  },
})

function filterParcelSharedSurveys(rows: Doc<"surveys">[]): Doc<"surveys">[] {
  // Shared parcel definition matches the frontend:
  // same ULB + normalized wardNo + normalized parcelNo (ignores unit/property use).
  const countsByParcelKey = new Map<string, number>()

  for (const row of rows) {
    if (!row.wardNo?.trim() || !row.parcelNo?.trim()) continue
    const key = `${row.municipalityId}:${normalizeWardNo(row.wardNo)}:${normalizeParcelKey(row.parcelNo)}`
    countsByParcelKey.set(key, (countsByParcelKey.get(key) ?? 0) + 1)
  }

  const sharedKeys = new Set(
    Array.from(countsByParcelKey.entries())
      .filter(([, count]) => count > 1)
      .map(([k]) => k)
  )
  if (sharedKeys.size === 0) return []

  return rows.filter((row) => {
    if (!row.wardNo?.trim() || !row.parcelNo?.trim()) return false
    const key = `${row.municipalityId}:${normalizeWardNo(row.wardNo)}:${normalizeParcelKey(row.parcelNo)}`
    return sharedKeys.has(key)
  })
}

/** Cursor-paginated survey list sorted by ward then parcel ascending. */
export const listPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    ...listFilterArgs,
  },
  returns: v.object(surveyListPaginatedResultShape),
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const scope = await resolveTenantScope(ctx, me)
    const districtIds = tenantDistrictIds(scope)
    const muniIds = tenantMunicipalityIds(scope)
    const access = await fieldSurveyAccess(ctx, me)

    if (args.municipalityId) {
      await assertMunicipalityInScope(ctx, me, args.municipalityId)
    }
    if (args.districtId && access !== "admin" && !districtIds.has(args.districtId)) {
      clientError("FORBIDDEN", "This district is outside your assigned scope")
    }

    const offset = parseListOffset(args.paginationOpts.cursor)
    const numItems = args.paginationOpts.numItems
    const statsTotal =
      !args.parcelSharedOnly && scopeStatsFastPathEligible(args)
        ? await resolveListTotalFromStats(ctx, me, args.nowMs, {
            districtId: args.districtId,
            municipalityId: args.municipalityId,
            status: args.status,
            qcStatus: args.qcStatus,
          })
        : null
    const scanLimit =
      statsTotal !== null
        ? Math.min(LIST_PAGINATED_SCOPE_LIMIT, Math.max(statsTotal, offset + numItems + 50))
        : LIST_PAGINATED_SCOPE_LIMIT

    let filtered = await collectSurveysForListPaginated(ctx, me, args, scope, muniIds, access, scanLimit)

    if (args.parcelSharedOnly) {
      filtered = filterParcelSharedSurveys(filtered)
    }

    if (args.searchTerm?.trim()) {
      filtered = await filterRowsBySearchTerm(ctx, filtered, args.searchTerm)
    }

    const scopeTruncated =
      statsTotal === null ? filtered.length >= scanLimit : statsTotal > scanLimit && filtered.length >= scanLimit
    if (filtered.length > scanLimit) {
      filtered = filtered.slice(0, scanLimit)
    }

    const totalCount = statsTotal ?? filtered.length
    const pageRows = filtered.slice(offset, offset + numItems)
    const nextOffset = offset + numItems

    const codes = await loadMunicipalityCodes(
      ctx,
      pageRows.map((r) => r.municipalityId)
    )
    const enriched = enrichSurveyPropertyIds(pageRows, codes)
    const named = await enrichSurveyorNames(ctx, enriched)
    const page = named

    return {
      page,
      continueCursor: nextOffset < totalCount ? String(nextOffset) : null,
      isDone: nextOffset >= totalCount,
      totalCount,
      scopeTruncated,
    }
  },
})

/** Scoped KPI counts for the Survey Command Center ΓÇö full dataset, not client-capped. */
export const commandCenterStats = query({
  args: {
    districtId: v.optional(v.id("districts")),
    municipalityId: v.optional(v.id("municipalities")),
    wardNo: v.optional(v.string()),
    status: v.optional(surveyStatus),
    qcStatus: v.optional(qcStatus),
    fromMs: v.optional(v.number()),
    toMs: v.optional(v.number()),
    nowMs: v.number(),
  },
  returns: v.object(surveyCommandCenterStatsShape),
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const scope = await resolveTenantScope(ctx, me)
    const districtIds = tenantDistrictIds(scope)
    const muniIds = tenantMunicipalityIds(scope)
    const access = await fieldSurveyAccess(ctx, me)

    if (args.municipalityId) {
      await assertMunicipalityInScope(ctx, me, args.municipalityId)
    }
    if (args.districtId && access !== "admin" && !districtIds.has(args.districtId)) {
      clientError("FORBIDDEN", "This district is outside your assigned scope")
    }

    const todayMs = (() => {
      const d = new Date(args.nowMs)
      d.setHours(0, 0, 0, 0)
      return d.getTime()
    })()

    const listArgs = {
      districtId: args.districtId,
      municipalityId: args.municipalityId,
      wardNo: args.wardNo,
      status: args.status,
      qcStatus: args.qcStatus,
    }

    const useStatsFastPath =
      !args.wardNo && args.fromMs === undefined && args.toMs === undefined && !args.status && !args.qcStatus

    const rows = await collectSurveysForListPaginated(
      ctx,
      me,
      listArgs,
      scope,
      muniIds,
      access,
      COMMAND_CENTER_WARD_SCAN_LIMIT
    )

    const inDateRange = (submittedAt: number | undefined, creationTime: number) => {
      const ts = submittedAt ?? creationTime
      if (args.fromMs !== undefined && ts < args.fromMs) return false
      if (args.toMs !== undefined && ts > args.toMs) return false
      return true
    }

    const filtered = rows.filter((r) => inDateRange(r.submittedAt, r._creationTime))

    const wardAggregates = computeSurveyWardAggregates(filtered)
    const allSurveyorIds = [...new Set(wardAggregates.flatMap((w) => w.activeSurveyorIds))]
    const surveyors = await Promise.all(allSurveyorIds.map((id) => ctx.db.get(id)))
    const nameById = new Map<Id<"users">, string>()
    for (const s of surveyors) {
      if (s) nameById.set(s._id, s.name)
    }

    const wardStats = wardAggregates.map((w) => {
      const names = w.activeSurveyorIds.map((id) => nameById.get(id)).filter((n): n is string => Boolean(n))
      return {
        wardNo: w.wardNo,
        municipalityId: w.municipalityId,
        city: w.city,
        total: w.total,
        drafts: w.drafts,
        submitted: w.submitted,
        qcApproved: w.qcApproved,
        activeSurveyorCount: w.activeSurveyorIds.length,
        activeSurveyorNames: names.slice(0, 5),
      }
    })

    if (useStatsFastPath) {
      const summary = await loadScopeStatsSummary(ctx, me, todayMs, {
        districtId: args.districtId,
        municipalityId: args.municipalityId,
      })
      if (summary) {
        const completionSum = filtered.reduce((sum, row) => sum + (row.completionPct ?? 0), 0)
        return {
          total: summary.total,
          drafts: summary.drafts,
          submitted: summary.submitted,
          submittedToday: summary.submittedToday,
          qcApproved: summary.qcApproved,
          qcPending: summary.qcPending,
          qcRejected: summary.qcRejected,
          surveyCompletionPct: filtered.length > 0 ? Math.round(completionSum / filtered.length) : 0,
          wardStats,
        }
      }
    }

    let drafts = 0
    let submitted = 0
    let submittedToday = 0
    let qcApproved = 0
    let qcPending = 0
    let qcRejected = 0
    let completionSum = 0
    for (const row of filtered) {
      completionSum += row.completionPct ?? 0
      if (row.status === "draft") drafts += 1
      if (row.status === "submitted") {
        submitted += 1
        const submittedTs = row.submittedAt ?? row._creationTime
        if (submittedTs >= todayMs) submittedToday += 1
      }
      if (row.qcStatus === "approved") qcApproved += 1
      if (row.qcStatus === "pending" && row.status === "submitted") qcPending += 1
      if (row.qcStatus === "rejected") qcRejected += 1
    }
    const surveyCompletionPct = filtered.length > 0 ? Math.round(completionSum / filtered.length) : 0

    return {
      total: filtered.length,
      drafts,
      submitted,
      submittedToday,
      qcApproved,
      qcPending,
      qcRejected,
      surveyCompletionPct,
      wardStats,
    }
  },
})

/** Single survey with floors + photos + QC remarks hydrated for the detail screen. */
export const get = query({
  args: { id: v.id("surveys") },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, args) => {
    const [me, survey] = await Promise.all([requireUser(ctx), ctx.db.get(args.id)])
    if (!survey) return null
    await assertCanAccessSurvey(ctx, me, survey)

    const [floors, photos, qcRemarks, surveyor, muni] = await Promise.all([
      ctx.db
        .query("floors")
        .withIndex("by_survey", (q) => q.eq("surveyId", args.id))
        .collect()
        .then((rows) => rows.sort((a, b) => a.position - b.position).map(presentFloorRow)),
      ctx.db
        .query("photos")
        .withIndex("by_survey", (q) => q.eq("surveyId", args.id))
        .collect(),
      ctx.db
        .query("qcRemarks")
        .withIndex("by_survey", (q) => q.eq("surveyId", args.id))
        .order("desc")
        .collect(),
      ctx.db.get(survey.surveyorId),
      ctx.db.get(survey.municipalityId),
    ])

    // Hydrate photo URLs from Convex storage so the client can display them directly.
    const hydratedPhotos = await Promise.all(
      photos.map(async (p) => ({
        ...p,
        url: await ctx.storage.getUrl(p.storageId),
      }))
    )
    const propertyId = resolvePropertyId(survey, muni?.code ?? "") ?? survey.propertyId

    return {
      ...survey,
      propertyId,
      districtId: muni?.districtId ?? survey.districtId,
      floors,
      photos: hydratedPhotos,
      qcRemarks,
      surveyor: surveyor ? { _id: surveyor._id, name: surveyor.name } : null,
    }
  },
})

export const getByLocalId = query({
  args: { localId: v.string() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    return await ctx.db
      .query("surveys")
      .withIndex("by_surveyor_localId", (q) => q.eq("surveyorId", me._id).eq("localId", args.localId))
      .unique()
  },
})
