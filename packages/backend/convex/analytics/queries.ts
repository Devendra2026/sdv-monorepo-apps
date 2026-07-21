/**
 * Survey analytics — district, ULB, and surveyor breakdowns for admin & supervisor panels.
 *
 * All counts respect `resolveTenantScope`: supervisors see only their district/ULB;
 * admins see the full catalog. Optional filters narrow the summary and child tables.
 *
 * Also includes time-series + coverage aggregates and web-only dashboard queries.
 */
import { v } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import { query, type QueryCtx } from "../_generated/server"
import {
  loadSurveyorStatsForScope,
  loadWardStatsForScope,
  type SurveyorStatsRollup,
  type WardStatsRollup,
} from "../lib/surveyRollupStats"
import {
  loadAnalyticsBreakdownFromStats,
  loadBoundedScopedSurveyRows,
  loadDashboardCountsForHome,
  loadDashboardDailyTrend,
} from "../lib/surveyScopeStats"
import {
  buildGroupSurveyCounts,
  computeDailyTrendFromSlice,
  computeWardCoverageFromSlice,
  countRowsFromSlice,
  type SurveyStatsSlice,
} from "../lib/surveyStatsAggregate"
import { qcStatus, surveyStatus } from "../schema"
import { startOfDayMs } from "../shared/calendar"
import { hasCapability, requireCapability } from "../shared/capabilities"
import { querySurveysInFieldScope } from "../shared/fieldAccess"
import { clientError, requireUser } from "../shared/helpers"
import {
  assertMunicipalityInScope,
  resolveDashboardTenantScope,
  resolveTenantScope,
  tenantDistrictIds,
  tenantMunicipalityIds,
} from "../shared/tenancy"

const ANALYTICS_SURVEYOR_SLICE_LIMIT = 2000
const MS_PER_DAY = 86_400_000
/** Per-ULB QC decisions loaded for dashboard / Reports (lowered to stay under syscall limits). */
const DASHBOARD_QC_DECISIONS_PER_REVIEWER_CAP = 200
/**
 * Max municipalities processed in QC decision fan-out for large admin scopes.
 * Before: every ULB in scope × take(400) → SystemTimeout.
 * After: hard ULB budget; remaining ULBs omitted from QC throughput tables.
 */
const DASHBOARD_QC_ULB_CAP = 12
const DASHBOARD_ANALYTICS_WINDOW_BUFFER_DAYS = 14
/** Max active users loaded per municipality for role-scoped filter options. */
const DASHBOARD_USERS_PER_MUNI_CAP = 200

export const surveyCountsShape = {
  total: v.number(),
  today: v.number(),
  drafts: v.number(),
  submitted: v.number(),
  approved: v.number(),
  rejected: v.number(),
}

const breakdownRow = {
  ...surveyCountsShape,
}

const qcSupervisorRow = {
  reviewerId: v.id("users"),
  name: v.string(),
  email: v.string(),
  approved: v.number(),
  rejected: v.number(),
  total: v.number(),
}

const userFilterOption = v.object({
  _id: v.id("users"),
  name: v.string(),
  email: v.string(),
})

const surveyCountsShapeLocal = {
  total: v.number(),
  today: v.number(),
  drafts: v.number(),
  submitted: v.number(),
  approved: v.number(),
  rejected: v.number(),
}

const dashboardCountsShape = {
  total: v.number(),
  today: v.number(),
  drafts: v.number(),
  pending: v.number(),
  submittedToday: v.number(),
  approved: v.number(),
  submitted: v.number(),
  rejected: v.number(),
}

const statsBreakdownShape = v.object({
  summary: v.object(surveyCountsShapeLocal),
  byDistrict: v.array(
    v.object({
      districtId: v.id("districts"),
      code: v.string(),
      name: v.string(),
      ...breakdownRow,
    })
  ),
  byUlb: v.array(
    v.object({
      municipalityId: v.id("municipalities"),
      code: v.string(),
      name: v.string(),
      districtId: v.id("districts"),
      districtName: v.string(),
      ...breakdownRow,
    })
  ),
  bySurveyor: v.array(
    v.object({
      surveyorId: v.id("users"),
      name: v.string(),
      email: v.string(),
      municipalityName: v.union(v.string(), v.null()),
      districtName: v.union(v.string(), v.null()),
      status: v.literal("active"),
      ...breakdownRow,
    })
  ),
  byQcSupervisor: v.array(v.object(qcSupervisorRow)),
  filterOptions: v.object({
    districts: v.array(
      v.object({
        _id: v.id("districts"),
        code: v.string(),
        name: v.string(),
      })
    ),
    municipalities: v.array(
      v.object({
        _id: v.id("municipalities"),
        code: v.string(),
        name: v.string(),
        districtId: v.id("districts"),
      })
    ),
    surveyors: v.array(userFilterOption),
    qcSupervisors: v.array(userFilterOption),
  }),
})

const dailyTrendPointShape = v.object({
  date: v.string(),
  created: v.number(),
  submitted: v.number(),
  approved: v.number(),
  rejected: v.number(),
})

const wardCoverageRowShape = v.object({
  municipalityId: v.id("municipalities"),
  municipalityName: v.string(),
  wardNo: v.string(),
  total: v.number(),
  approved: v.number(),
  approvalRate: v.number(),
})

const analyticsBundleShape = v.union(
  v.null(),
  v.object({
    breakdown: statsBreakdownShape,
    dailyTrend: v.array(dailyTrendPointShape),
    wardCoverage: v.array(wardCoverageRowShape),
  })
)

const homeBundleShape = v.object({
  counts: v.object(dashboardCountsShape),
  analytics: analyticsBundleShape,
})

const EMPTY_COUNTS = {
  total: 0,
  today: 0,
  drafts: 0,
  pending: 0,
  submittedToday: 0,
  approved: 0,
  submitted: 0,
  rejected: 0,
}

const recentActivityRowShape = v.object({
  _id: v.id("surveys"),
  propertyId: v.optional(v.string()),
  parcelNo: v.optional(v.string()),
  status: surveyStatus,
  qcStatus: qcStatus,
  _creationTime: v.number(),
  submittedAt: v.optional(v.number()),
  surveyor: v.optional(v.object({ name: v.optional(v.string()) })),
})

export type SurveyCounts = {
  total: number
  today: number
  drafts: number
  submitted: number
  approved: number
  rejected: number
}

function countRows(rows: Doc<"surveys">[] | SurveyStatsSlice[], todayStartMs: number | null): SurveyCounts {
  return countRowsFromSlice(rows, todayStartMs)
}

/** Load a bounded survey slice for per-surveyor analytics (avoids full-table collect). */
async function loadBoundedSurveysForAnalytics(
  ctx: QueryCtx,
  me: Doc<"users">,
  filters: {
    districtId?: Id<"districts">
    municipalityId?: Id<"municipalities">
    surveyorId?: Id<"users">
  }
): Promise<Doc<"surveys">[]> {
  return querySurveysInFieldScope(ctx, me, {
    districtId: filters.districtId,
    municipalityId: filters.municipalityId,
    surveyorId: filters.surveyorId,
    limit: ANALYTICS_SURVEYOR_SLICE_LIMIT,
  })
}

async function assertDistrictInScope(
  me: Doc<"users">,
  districtId: Id<"districts">,
  allowedDistrictIds: Set<Id<"districts">>
) {
  if (me.role === "admin") return
  if (!allowedDistrictIds.has(districtId)) {
    clientError("FORBIDDEN", "This district is outside your assigned scope")
  }
}

async function assertSurveyorInScope(
  ctx: QueryCtx,
  me: Doc<"users">,
  surveyor: Doc<"users">,
  muniIds: Set<Id<"municipalities">>,
  districtIds: Set<Id<"districts">>
) {
  if (me.role === "admin") return
  if (surveyor.municipalityId && muniIds.has(surveyor.municipalityId)) return
  if (surveyor.districtId && districtIds.has(surveyor.districtId)) return
  clientError("FORBIDDEN", "This surveyor is outside your assigned scope")
}

function groupCounts(
  rows: Doc<"surveys">[] | SurveyStatsSlice[],
  keyFn: (row: SurveyStatsSlice) => string,
  todayMs: number | null
): Map<string, SurveyCounts> {
  return buildGroupSurveyCounts(rows, keyFn, todayMs)
}

function filterActiveUsersInScope(
  users: Doc<"users">[],
  muniIds: Set<Id<"municipalities">>,
  districtIds: Set<Id<"districts">>,
  districtFilter?: Id<"districts">,
  muniFilter?: Id<"municipalities">,
  muniMap?: Map<Id<"municipalities">, Doc<"municipalities">>
): Doc<"users">[] {
  return users.filter((u) => {
    if (u.municipalityId && !muniIds.has(u.municipalityId)) return false
    if (u.districtId && !districtIds.has(u.districtId)) return false
    if (muniFilter && u.municipalityId !== muniFilter) return false
    if (districtFilter && u.districtId !== districtFilter) {
      if (u.municipalityId && muniMap) {
        const m = muniMap.get(u.municipalityId)
        if (m?.districtId !== districtFilter) return false
      } else return false
    }
    return true
  })
}

function filterActiveUsersInScopeSimple(
  users: Doc<"users">[],
  muniIds: Set<Id<"municipalities">>,
  districtIds: Set<Id<"districts">>
): Doc<"users">[] {
  return users.filter((u) => {
    if (u.municipalityId && !muniIds.has(u.municipalityId)) return false
    if (u.districtId && !districtIds.has(u.districtId)) return false
    return true
  })
}

/**
 * Load active users of a role within tenant scope via municipality indexes.
 *
 * Before: O(all users with role) — global `by_role_status` `.collect()` then filter in memory.
 * After: O(scoped municipalities) — parallel `by_municipality_status` lookups + role filter.
 */
async function loadActiveUsersInScopeByRole(
  ctx: QueryCtx,
  role: "surveyor" | "qc_supervisor",
  scopedMunicipalityIds: Id<"municipalities">[],
  muniIds: Set<Id<"municipalities">>,
  districtIds: Set<Id<"districts">>
): Promise<Doc<"users">[]> {
  if (scopedMunicipalityIds.length === 0) return []

  // Cap ULB fan-out for huge admin scopes (same budget as QC decisions).
  const targetMunis = scopedMunicipalityIds.slice(0, DASHBOARD_QC_ULB_CAP)

  const batches = await Promise.all(
    targetMunis.map((municipalityId) =>
      ctx.db
        .query("users")
        .withIndex("by_municipality_status", (q) => q.eq("municipalityId", municipalityId).eq("status", "active"))
        .take(DASHBOARD_USERS_PER_MUNI_CAP)
    )
  )

  const seen = new Set<string>()
  const users: Doc<"users">[] = []
  for (const batch of batches) {
    for (const u of batch) {
      if (u.role !== role) continue
      if (seen.has(u._id)) continue
      seen.add(u._id)
      users.push(u)
    }
  }

  return filterActiveUsersInScopeSimple(users, muniIds, districtIds)
}

/** Hydrate surveyor docs from rollup IDs (O(unique surveyors) gets — no global collect). */
async function loadActiveSurveyorsByIds(ctx: QueryCtx, surveyorIds: Id<"users">[]): Promise<Doc<"users">[]> {
  const unique = [...new Set(surveyorIds)]
  if (unique.length === 0) return []
  const docs = await Promise.all(unique.map((id) => ctx.db.get("users", id)))
  return docs.filter((u): u is Doc<"users"> => u != null && u.status === "active" && u.role === "surveyor")
}

function buildQcSupervisorRows(
  activeQcSupervisors: Doc<"users">[],
  decisionsByReviewer: Map<Id<"users">, Doc<"qcDecisions">[]>
) {
  return activeQcSupervisors
    .map((u) => {
      const scoped = decisionsByReviewer.get(u._id) ?? []
      let approved = 0
      let rejected = 0
      for (const decision of scoped) {
        if (decision.decision === "approve") approved += 1
        if (decision.decision === "reject") rejected += 1
      }
      return {
        reviewerId: u._id,
        name: u.name,
        email: u.email,
        approved,
        rejected,
        total: scoped.length,
      }
    })
    .sort((a, b) => b.total - a.total)
}

/** Pick the cheaper QC decision load strategy based on scope size. */
async function loadScopedQcDecisionsByReviewer(
  ctx: QueryCtx,
  scopedSurveyIds: Set<Id<"surveys">>,
  scopedMunicipalityIds: Set<Id<"municipalities">>,
  activeQcSupervisors: Doc<"users">[],
  fromMs: number
): Promise<Map<Id<"users">, Doc<"qcDecisions">[]>> {
  const byReviewer = new Map<Id<"users">, Doc<"qcDecisions">[]>()
  for (const u of activeQcSupervisors) {
    byReviewer.set(u._id, [])
  }

  if ((scopedSurveyIds.size === 0 && scopedMunicipalityIds.size === 0) || activeQcSupervisors.length === 0) {
    return byReviewer
  }

  const reviewerIds = new Set(activeQcSupervisors.map((u) => u._id))
  const perMuniCap = DASHBOARD_QC_DECISIONS_PER_REVIEWER_CAP

  if (scopedMunicipalityIds.size > 0) {
    // Hard-cap ULBs so multi-district admins cannot exceed syscall budget.
    const muniList = [...scopedMunicipalityIds].slice(0, DASHBOARD_QC_ULB_CAP)
    const batches = await Promise.all(
      muniList.map(async (municipalityId) => {
        if (fromMs > 0) {
          return await ctx.db
            .query("qcDecisions")
            .withIndex("by_municipality_decided", (q) =>
              q.eq("municipalityId", municipalityId).gte("decidedAt", fromMs)
            )
            .take(perMuniCap)
        }
        return await ctx.db
          .query("qcDecisions")
          .withIndex("by_municipality_decided", (q) => q.eq("municipalityId", municipalityId))
          .order("desc")
          .take(perMuniCap)
      })
    )

    for (const decisions of batches) {
      for (const decision of decisions) {
        if (!reviewerIds.has(decision.reviewerId)) continue
        if (scopedSurveyIds.size > 0 && !scopedSurveyIds.has(decision.surveyId)) continue
        const bucket = byReviewer.get(decision.reviewerId)
        if (bucket) bucket.push(decision)
      }
    }
    return byReviewer
  }

  await Promise.all(
    activeQcSupervisors.map(async (reviewer) => {
      const decisions = await ctx.db
        .query("qcDecisions")
        .withIndex("by_reviewer", (q) => q.eq("reviewerId", reviewer._id))
        .order("desc")
        .take(DASHBOARD_QC_DECISIONS_PER_REVIEWER_CAP)
      for (const decision of decisions) {
        if (fromMs > 0 && decision._creationTime < fromMs) continue
        if (!scopedSurveyIds.has(decision.surveyId)) continue
        const bucket = byReviewer.get(decision.reviewerId)
        if (bucket) bucket.push(decision)
      }
    })
  )
  return byReviewer
}

function wardCoverageFromRollups(
  wardRows: WardStatsRollup[],
  muniMap: Map<Id<"municipalities">, Doc<"municipalities">>
) {
  return wardRows
    .map((w) => ({
      municipalityId: w.municipalityId,
      municipalityName: muniMap.get(w.municipalityId)?.name ?? "—",
      wardNo: w.wardNo,
      total: w.total,
      approved: w.qcApproved,
      approvalRate: w.total > 0 ? Math.round((w.qcApproved / w.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)
}

function aggregateSurveyorRollups(rollups: SurveyorStatsRollup[]): Map<Id<"users">, SurveyCounts> {
  const groups = new Map<Id<"users">, SurveyCounts>()
  for (const row of rollups) {
    const bucket = groups.get(row.surveyorId) ?? {
      total: 0,
      today: 0,
      drafts: 0,
      submitted: 0,
      approved: 0,
      rejected: 0,
    }
    bucket.total += row.total
    bucket.drafts += row.drafts
    bucket.submitted += row.submitted
    bucket.approved += row.qcApproved
    bucket.rejected += row.qcRejected
    groups.set(row.surveyorId, bucket)
  }
  return groups
}

/**
 * Home-path breakdown from rollups — no QC decision fan-out.
 *
 * Before: global user collects + QC decisions × ULBs inside analyticsBundle (timeout risk).
 * After: surveyor docs from rollup IDs + scoped municipality user loads; QC left empty for qcSupervisorBundle.
 */
async function buildDashboardBreakdownFromRollups(
  ctx: QueryCtx,
  _me: Doc<"users">,
  statsBreakdown: Awaited<ReturnType<typeof loadAnalyticsBreakdownFromStats>>,
  surveyorRollups: SurveyorStatsRollup[],
  todayStartMs: number,
  _fromMs: number,
  scope: Awaited<ReturnType<typeof resolveTenantScope>>
) {
  const districtIds = tenantDistrictIds(scope)
  const muniIds = tenantMunicipalityIds(scope)
  const districtMap = new Map(scope.districts.map((d) => [d._id, d]))
  const muniMap = new Map(scope.municipalities.map((m) => [m._id, m]))
  const bySurveyorGroups = aggregateSurveyorRollups(surveyorRollups)

  const byDistrict = statsBreakdown?.byDistrict ?? []
  const byUlb = statsBreakdown?.byUlb ?? []

  const scopedMuniList = [...muniIds]
  const [rollupSurveyors, scopedSurveyors] = await Promise.all([
    loadActiveSurveyorsByIds(
      ctx,
      surveyorRollups.map((r) => r.surveyorId)
    ),
    loadActiveUsersInScopeByRole(ctx, "surveyor", scopedMuniList, muniIds, districtIds),
  ])

  const surveyorById = new Map<Id<"users">, Doc<"users">>()
  for (const u of [...rollupSurveyors, ...scopedSurveyors]) {
    surveyorById.set(u._id, u)
  }
  const activeSurveyors = [...surveyorById.values()]

  const bySurveyor = activeSurveyors
    .map((u) => {
      const counts = bySurveyorGroups.get(u._id) ?? countRows([], todayStartMs)
      const muni = u.municipalityId ? muniMap.get(u.municipalityId) : undefined
      const dist = u.districtId ? districtMap.get(u.districtId) : muni ? districtMap.get(muni.districtId) : undefined
      return {
        surveyorId: u._id,
        name: u.name,
        email: u.email,
        municipalityName: muni?.name ?? null,
        districtName: dist?.name ?? null,
        status: "active" as const,
        ...counts,
      }
    })
    .sort((a, b) => b.approved + b.submitted - (a.approved + a.submitted))

  const summary =
    statsBreakdown?.summary ??
    [...bySurveyorGroups.values()].reduce<SurveyCounts>(
      (acc, row) => ({
        total: acc.total + row.total,
        today: acc.today + row.today,
        drafts: acc.drafts + row.drafts,
        submitted: acc.submitted + row.submitted,
        approved: acc.approved + row.approved,
        rejected: acc.rejected + row.rejected,
      }),
      { total: 0, today: 0, drafts: 0, submitted: 0, approved: 0, rejected: 0 }
    )

  return {
    summary,
    byDistrict,
    byUlb,
    bySurveyor,
    // QC loaded by qcSupervisorBundle — keep empty arrays for StatsBreakdown shape compatibility.
    byQcSupervisor: [] as ReturnType<typeof buildQcSupervisorRows>,
    filterOptions: {
      districts: scope.districts.map((d) => ({ _id: d._id, code: d.code, name: d.name })),
      municipalities: scope.municipalities.map((m) => ({
        _id: m._id,
        code: m.code,
        name: m.name,
        districtId: m.districtId,
      })),
      surveyors: activeSurveyors.map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
      })),
      qcSupervisors: [] as Array<{ _id: Id<"users">; name: string; email: string }>,
    },
  }
}

/**
 * QC supervisor throughput for home dashboard (sibling of analyticsBundle).
 *
 * Before: embedded in analyticsBundle → home timed out on multi-ULB QC fan-out.
 * After: O(scoped ULBs × capped decisions) on an independent subscription.
 */
async function buildQcSupervisorBundle(
  ctx: QueryCtx,
  me: Doc<"users">,
  fromMs: number
): Promise<{
  byQcSupervisor: ReturnType<typeof buildQcSupervisorRows>
  qcSupervisors: Array<{ _id: Id<"users">; name: string; email: string }>
  truncated: boolean
  omittedMunicipalityCount: number
}> {
  const scope = await resolveDashboardTenantScope(ctx, me)
  const districtIds = tenantDistrictIds(scope)
  const muniIds = tenantMunicipalityIds(scope)
  // Cap ULB list before user + decision fan-out for large admin scopes.
  const scopedMuniList = [...muniIds].slice(0, DASHBOARD_QC_ULB_CAP)
  const omittedMunicipalityCount = Math.max(0, muniIds.size - scopedMuniList.length)

  const activeQcSupervisors = await loadActiveUsersInScopeByRole(
    ctx,
    "qc_supervisor",
    scopedMuniList,
    muniIds,
    districtIds
  )

  const decisionsByReviewer = await loadScopedQcDecisionsByReviewer(
    ctx,
    new Set(),
    new Set(scopedMuniList),
    activeQcSupervisors,
    fromMs
  )

  return {
    byQcSupervisor: buildQcSupervisorRows(activeQcSupervisors, decisionsByReviewer),
    qcSupervisors: activeQcSupervisors.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
    })),
    truncated: omittedMunicipalityCount > 0,
    omittedMunicipalityCount,
  }
}

async function buildAnalyticsBundle(
  ctx: QueryCtx,
  me: Doc<"users">,
  todayMs: number,
  trendDays: number,
  nowMs: number
) {
  const canViewAnalytics = await hasCapability(ctx, me, "analytics.view")
  if (!canViewAnalytics) return null

  const days = Math.min(Math.max(trendDays, 1), 180)
  const analyticsFromMs = nowMs - (days + DASHBOARD_ANALYTICS_WINDOW_BUFFER_DAYS) * MS_PER_DAY
  const scope = await resolveDashboardTenantScope(ctx, me)
  const muniMap = new Map(scope.municipalities.map((m) => [m._id, m]))

  const [statsBreakdown, wardRows, surveyorRollups, dailyTrend] = await Promise.all([
    loadAnalyticsBreakdownFromStats(ctx, me, todayMs, scope),
    loadWardStatsForScope(ctx, me),
    loadSurveyorStatsForScope(ctx, me),
    loadDashboardDailyTrend(ctx, me, days, nowMs),
  ])

  const wardCoverage = wardCoverageFromRollups(wardRows, muniMap)

  const breakdown = await buildDashboardBreakdownFromRollups(
    ctx,
    me,
    statsBreakdown,
    surveyorRollups,
    todayMs,
    analyticsFromMs,
    scope
  )

  return { breakdown, dailyTrend, wardCoverage }
}

/**
 * Aggregated survey KPIs with district / ULB / surveyor breakdown tables.
 * Drives admin Reports and supervisor dashboard analytics.
 */
export const surveyStatsBreakdown = query({
  args: {
    districtId: v.optional(v.id("districts")),
    municipalityId: v.optional(v.id("municipalities")),
    surveyorId: v.optional(v.id("users")),
    nowMs: v.optional(v.number()),
  },
  returns: v.object({
    summary: v.object(surveyCountsShape),
    byDistrict: v.array(
      v.object({
        districtId: v.id("districts"),
        code: v.string(),
        name: v.string(),
        ...breakdownRow,
      })
    ),
    byUlb: v.array(
      v.object({
        municipalityId: v.id("municipalities"),
        code: v.string(),
        name: v.string(),
        districtId: v.id("districts"),
        districtName: v.string(),
        ...breakdownRow,
      })
    ),
    bySurveyor: v.array(
      v.object({
        surveyorId: v.id("users"),
        name: v.string(),
        email: v.string(),
        municipalityName: v.union(v.string(), v.null()),
        districtName: v.union(v.string(), v.null()),
        status: v.literal("active"),
        ...breakdownRow,
      })
    ),
    byQcSupervisor: v.array(v.object(qcSupervisorRow)),
    filterOptions: v.object({
      districts: v.array(
        v.object({
          _id: v.id("districts"),
          code: v.string(),
          name: v.string(),
        })
      ),
      municipalities: v.array(
        v.object({
          _id: v.id("municipalities"),
          code: v.string(),
          name: v.string(),
          districtId: v.id("districts"),
        })
      ),
      surveyors: v.array(userFilterOption),
      qcSupervisors: v.array(userFilterOption),
    }),
  }),
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    await requireCapability(ctx, me, "analytics.view")

    const scope = await resolveTenantScope(ctx, me)
    const districtIds = tenantDistrictIds(scope)
    const muniIds = tenantMunicipalityIds(scope)

    const todayStartMs = args.nowMs !== undefined ? startOfDayMs(args.nowMs) : null

    const districtMap = new Map(scope.districts.map((d) => [d._id, d]))
    const muniMap = new Map(scope.municipalities.map((m) => [m._id, m]))

    const statsBreakdown =
      !args.surveyorId && todayStartMs !== null
        ? await loadAnalyticsBreakdownFromStats(ctx, me, todayStartMs, scope, {
            districtId: args.districtId,
            municipalityId: args.municipalityId,
          })
        : null

    let rows = await loadBoundedSurveysForAnalytics(ctx, me, {
      districtId: args.districtId,
      municipalityId: args.municipalityId,
      surveyorId: args.surveyorId,
    })

    if (args.districtId) {
      await assertDistrictInScope(me, args.districtId, districtIds)
      rows = rows.filter((r) => r.districtId === args.districtId)
    }
    if (args.municipalityId) {
      await assertMunicipalityInScope(ctx, me, args.municipalityId)
      rows = rows.filter((r) => r.municipalityId === args.municipalityId)
    }
    if (args.surveyorId) {
      const surveyor = await ctx.db.get("users", args.surveyorId)
      if (!surveyor || surveyor.role !== "surveyor") {
        clientError("BAD_REQUEST", "Unknown surveyor")
      }
      await assertSurveyorInScope(ctx, me, surveyor, muniIds, districtIds)
      rows = rows.filter((r) => r.surveyorId === args.surveyorId)
    }

    const byDistrict =
      statsBreakdown?.byDistrict ??
      (() => {
        const byDistrictGroups = groupCounts(rows, (r) => r.districtId, todayStartMs)
        return [...byDistrictGroups.entries()]
          .map(([districtId, counts]) => {
            const d = districtMap.get(districtId as Id<"districts">)
            return {
              districtId: districtId as Id<"districts">,
              code: d?.code ?? "—",
              name: d?.name ?? "Unknown district",
              ...counts,
            }
          })
          .sort((a, b) => a.name.localeCompare(b.name))
      })()

    const byUlb =
      statsBreakdown?.byUlb ??
      (() => {
        const byUlbGroups = groupCounts(rows, (r) => r.municipalityId, todayStartMs)
        return [...byUlbGroups.entries()]
          .map(([municipalityId, counts]) => {
            const m = muniMap.get(municipalityId as Id<"municipalities">)
            const d = m ? districtMap.get(m.districtId) : undefined
            const sampleDistrictId = rows.find((r) => r.municipalityId === municipalityId)?.districtId
            return {
              municipalityId: municipalityId as Id<"municipalities">,
              code: m?.code ?? "—",
              name: m?.name ?? "Unknown ULB",
              districtId: m?.districtId ?? sampleDistrictId ?? (municipalityId as Id<"districts">),
              districtName: d?.name ?? "—",
              ...counts,
            }
          })
          .sort((a, b) => a.name.localeCompare(b.name))
      })()

    const bySurveyorGroups = groupCounts(rows, (r) => r.surveyorId, todayStartMs)

    // Before: global by_role_status collects for surveyor + qc_supervisor.
    // After: municipality-scoped indexed loads (O(scoped ULBs)).
    let scopedMuniList = [...muniIds]
    if (args.municipalityId) {
      scopedMuniList = [args.municipalityId]
    } else if (args.districtId) {
      scopedMuniList = scope.municipalities.filter((m) => m.districtId === args.districtId).map((m) => m._id)
    }

    const [scopedSurveyors, scopedQcSupervisors] = await Promise.all([
      loadActiveUsersInScopeByRole(ctx, "surveyor", scopedMuniList, muniIds, districtIds),
      loadActiveUsersInScopeByRole(ctx, "qc_supervisor", scopedMuniList, muniIds, districtIds),
    ])

    const activeSurveyors = filterActiveUsersInScope(
      scopedSurveyors,
      muniIds,
      districtIds,
      args.districtId,
      args.municipalityId,
      muniMap
    )

    const bySurveyor = activeSurveyors
      .map((u) => {
        const counts = bySurveyorGroups.get(u._id) ?? countRows([], todayStartMs)
        const muni = u.municipalityId ? muniMap.get(u.municipalityId) : undefined
        const dist = u.districtId ? districtMap.get(u.districtId) : muni ? districtMap.get(muni.districtId) : undefined
        return {
          surveyorId: u._id,
          name: u.name,
          email: u.email,
          municipalityName: muni?.name ?? null,
          districtName: dist?.name ?? null,
          status: "active" as const,
          ...counts,
        }
      })
      .sort((a, b) => b.approved + b.submitted - (a.approved + a.submitted))

    const activeQcSupervisors = filterActiveUsersInScope(
      scopedQcSupervisors,
      muniIds,
      districtIds,
      args.districtId,
      args.municipalityId,
      muniMap
    )

    // Prefer municipality-scoped decisions (fromMs=0) over survey-id filtering when filters narrow ULBs.
    const scopedMunicipalityIds =
      scopedMuniList.length > 0 ? new Set(scopedMuniList) : new Set(rows.map((r) => r.municipalityId))
    const scopedSurveyIds = args.surveyorId ? new Set(rows.map((r) => r._id)) : new Set<Id<"surveys">>()
    const decisionsByReviewer = await loadScopedQcDecisionsByReviewer(
      ctx,
      scopedSurveyIds,
      scopedMunicipalityIds,
      activeQcSupervisors,
      0
    )

    const byQcSupervisor = buildQcSupervisorRows(activeQcSupervisors, decisionsByReviewer)

    const filterMunicipalities = scope.municipalities.filter(
      (m) => !args.districtId || m.districtId === args.districtId
    )

    return {
      summary: statsBreakdown?.summary ?? countRows(rows, todayStartMs),
      byDistrict,
      byUlb,
      bySurveyor,
      byQcSupervisor,
      filterOptions: {
        districts: scope.districts.map((d) => ({ _id: d._id, code: d.code, name: d.name })),
        municipalities: filterMunicipalities.map((m) => ({
          _id: m._id,
          code: m.code,
          name: m.name,
          districtId: m.districtId,
        })),
        surveyors: activeSurveyors.map((u) => ({
          _id: u._id,
          name: u.name,
          email: u.email,
        })),
        qcSupervisors: activeQcSupervisors.map((u) => ({
          _id: u._id,
          name: u.name,
          email: u.email,
        })),
      },
    }
  },
})

/**
 * Daily survey + approval trend over the last `days` days (default 30),
 * scoped to the caller. Returns a dense series (zero-filled) so charts
 * don't show gaps.
 */
export const dailyTrend = query({
  args: {
    days: v.optional(v.number()),
    districtId: v.optional(v.id("districts")),
    municipalityId: v.optional(v.id("municipalities")),
    nowMs: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      date: v.string(),
      created: v.number(),
      submitted: v.number(),
      approved: v.number(),
      rejected: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    await requireCapability(ctx, me, "analytics.view")
    const days = Math.min(Math.max(args.days ?? 30, 1), 180)

    if (args.nowMs === undefined) {
      return []
    }

    if (!args.districtId && !args.municipalityId) {
      return loadDashboardDailyTrend(ctx, me, days, args.nowMs)
    }

    let rows = await loadBoundedScopedSurveyRows(ctx, me)
    if (args.districtId) rows = rows.filter((r) => r.districtId === args.districtId)
    if (args.municipalityId) rows = rows.filter((r) => r.municipalityId === args.municipalityId)

    return computeDailyTrendFromSlice(rows, days, args.nowMs)
  },
})

/** Per-ward coverage roll-up within tenant scope (brief's "Ward Coverage"). */
export const wardCoverage = query({
  args: {
    districtId: v.optional(v.id("districts")),
    municipalityId: v.optional(v.id("municipalities")),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    await requireCapability(ctx, me, "analytics.view")

    let rows = await loadBoundedScopedSurveyRows(ctx, me)
    if (args.districtId) rows = rows.filter((r) => r.districtId === args.districtId)
    if (args.municipalityId) rows = rows.filter((r) => r.municipalityId === args.municipalityId)

    const scope = await resolveTenantScope(ctx, me)
    const muniNames = new Map(scope.municipalities.map((m) => [m._id, m.name]))

    return computeWardCoverageFromSlice(rows, muniNames)
  },
})

/** Accurate KPI counts for the web home dashboard (stats tables when backfilled). */
export const counts = query({
  args: { nowMs: v.number() },
  returns: v.object(dashboardCountsShape),
  handler: async (ctx, args) => {
    const me = await requireUser(ctx, { allowPending: true })
    if (me.status !== "active") return EMPTY_COUNTS

    const todayMs = startOfDayMs(args.nowMs)
    return loadDashboardCountsForHome(ctx, me, todayMs)
  },
})

/** Charts and breakdown tables — capability-gated, separate subscription. */
export const analyticsBundle = query({
  args: {
    nowMs: v.number(),
    trendDays: v.optional(v.number()),
  },
  returns: analyticsBundleShape,
  handler: async (ctx, args) => {
    const me = await requireUser(ctx, { allowPending: true })
    if (me.status !== "active") return null

    const todayMs = startOfDayMs(args.nowMs)
    return buildAnalyticsBundle(ctx, me, todayMs, args.trendDays ?? 30, args.nowMs)
  },
})

const qcSupervisorBundleShape = v.object({
  byQcSupervisor: v.array(v.object(qcSupervisorRow)),
  qcSupervisors: v.array(userFilterOption),
  truncated: v.boolean(),
  omittedMunicipalityCount: v.number(),
})

/**
 * QC supervisor throughput for the home dashboard.
 * Loaded separately from analyticsBundle so charts succeed without waiting on QC fan-out.
 */
export const qcSupervisorBundle = query({
  args: {
    nowMs: v.number(),
    trendDays: v.optional(v.number()),
  },
  returns: v.union(v.null(), qcSupervisorBundleShape),
  handler: async (ctx, args) => {
    const me = await requireUser(ctx, { allowPending: true })
    if (me.status !== "active") return null

    const canViewAnalytics = await hasCapability(ctx, me, "analytics.view")
    if (!canViewAnalytics) return null

    const days = Math.min(Math.max(args.trendDays ?? 30, 1), 180)
    const fromMs = args.nowMs - (days + DASHBOARD_ANALYTICS_WINDOW_BUFFER_DAYS) * MS_PER_DAY
    return buildQcSupervisorBundle(ctx, me, fromMs)
  },
})

/**
 * Deprecated compatibility wrapper for the web home dashboard.
 * Prefer `counts` + `analyticsBundle` so KPIs and charts subscribe independently.
 */
export const homeBundle = query({
  args: {
    nowMs: v.number(),
    trendDays: v.optional(v.number()),
  },
  returns: homeBundleShape,
  handler: async (ctx, args) => {
    const me = await requireUser(ctx, { allowPending: true })

    if (me.status !== "active") {
      return { counts: EMPTY_COUNTS, analytics: null }
    }

    const todayMs = startOfDayMs(args.nowMs)
    const trendDays = args.trendDays ?? 30
    const [counts, analytics] = await Promise.all([
      loadDashboardCountsForHome(ctx, me, todayMs),
      buildAnalyticsBundle(ctx, me, todayMs, trendDays, args.nowMs),
    ])

    return { counts, analytics }
  },
})

/** Lightweight recent surveys for the home activity feed (web only). */
export const recentActivity = query({
  args: {},
  returns: v.array(recentActivityRowShape),
  handler: async (ctx) => {
    const me = await requireUser(ctx, { allowPending: true })
    if (me.status !== "active") return []

    const rows = await querySurveysInFieldScope(ctx, me, { limit: 20 })
    const surveyorIds = [...new Set(rows.map((r) => r.surveyorId))]
    const surveyors = await Promise.all(surveyorIds.map((id) => ctx.db.get("users", id)))
    const nameById = new Map<Id<"users">, string>()
    for (const s of surveyors) {
      if (s) nameById.set(s._id, s.name)
    }

    return rows.map((r) => ({
      _id: r._id,
      propertyId: r.propertyId,
      parcelNo: r.parcelNo,
      status: r.status,
      qcStatus: r.qcStatus,
      _creationTime: r._creationTime,
      submittedAt: r.submittedAt,
      surveyor: { name: nameById.get(r.surveyorId) },
    }))
  },
})
