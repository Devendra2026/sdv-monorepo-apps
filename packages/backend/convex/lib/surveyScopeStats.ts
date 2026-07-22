import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { dayEndMs, formatDateKey, startOfDayMs, startOfDayMsFromKey } from "../shared/calendar"
import { fieldSurveyAccess, type PrecomputedFieldContext } from "../shared/fieldAccess"
import { canReadWard } from "../shared/helpers"
import { resolveDashboardTenantScope, resolveTenantScope, tenantMunicipalityIds } from "../shared/tenancy"
import {
  filterLegacyAnalyticsRows,
  getLegacyDailyStatsRow,
  getLegacyMunicipalityStatsRow,
  getLegacyWardStatsRow,
  loadLegacyDailyStatsForDate,
  loadLegacyMunicipalityStatsForMunicipalities,
} from "./surveyAnalyticsLookups"
import {
  recordSurveyAnalyticsInsert,
  recordSurveyAnalyticsRemove,
  recordSurveyAnalyticsUpdate,
} from "./surveyAnalyticsWrites"
import {
  computeDailyTrendFromSlice,
  computeDashboardCountsFromSlice,
  type DashboardCounts,
  type SurveyCounts,
  type SurveyStatsSlice,
} from "./surveyStatsAggregate"

/** Max survey documents loaded for dashboard analytics fallbacks (avoids Convex read limits). */
export const DASHBOARD_BOUNDED_ROW_CAP = 2500

/**
 * Cap for live survey scans on home KPIs — much lower than DASHBOARD_BOUNDED_ROW_CAP
 * to prevent UserTimeout / isolate restarts on self-hosted SQLite.
 */
export const DASHBOARD_LIVE_FALLBACK_ROW_CAP = 400

/** Cap for surveyor "today" metrics only (lifetime KPIs come from surveySurveyorStats). */
export const DASHBOARD_SURVEYOR_TODAY_CAP = 200

/**
 * Max municipalities that may use live survey scans when rollups are cold/missing.
 * Larger scopes return zeros (degraded) instead of timing out.
 *
 * Before: live take(2500) × N ULBs → SystemTimeout.
 * After: O(1) indexed rollup reads; live only for ≤ this many ULBs (or ward-scoped users).
 */
export const DASHBOARD_LIVE_FALLBACK_ULB_CAP = 3

/**
 * Prefer one batched read over N point lookups when scoped ULB count exceeds this.
 */
export const STATS_BATCH_SCOPE_THRESHOLD = 10

/**
 * Max ULBs for live survey / QC-decision fan-out on dashboard paths.
 * Aligns with analyticsBundle QC budget — prevents admin scopes from saturating SQLite.
 */
export const DASHBOARD_FANOUT_ULB_CAP = 12

/**
 * Max QC decisions loaded per municipality for dashboard daily trend.
 * Before: 800 × every ULB → SystemTimeout / 32k doc scan.
 */
const DASHBOARD_QC_TREND_DECISIONS_CAP = 200

const MS_PER_DAY = 86_400_000

function emptyMunicipalityRollup(municipalityId: Id<"municipalities">): MunicipalityStatsRollup {
  return {
    municipalityId,
    total: 0,
    drafts: 0,
    submitted: 0,
    qcApproved: 0,
    qcRejected: 0,
    qcPending: 0,
  }
}

/** True when live survey scans are allowed for this scope size / access pattern. */
function mayUseLiveMunicipalityFallback(me: Doc<"users">, scopedMuniCount: number, wardScoped: boolean): boolean {
  if (wardScoped) return scopedMuniCount <= DASHBOARD_LIVE_FALLBACK_ULB_CAP
  if (me.role === "admin" && scopedMuniCount > DASHBOARD_LIVE_FALLBACK_ULB_CAP) return false
  return scopedMuniCount <= DASHBOARD_LIVE_FALLBACK_ULB_CAP
}

function istTrendBuckets<T>(days: number, nowMs: number, empty: () => T): { startMs: number; buckets: Map<string, T> } {
  const safeDays = Math.min(Math.max(days, 1), 180)
  const endDayStart = startOfDayMs(nowMs)
  const startMs = endDayStart - (safeDays - 1) * MS_PER_DAY
  const buckets = new Map<string, T>()
  for (let i = 0; i < safeDays; i++) {
    buckets.set(formatDateKey(startMs + i * MS_PER_DAY), empty())
  }
  return { startMs, buckets }
}

/** Bounded survey load by surveyor (no .paginate — safe inside bundled dashboard queries). */
async function loadSurveysBySurveyor(
  ctx: QueryCtx,
  surveyorId: Id<"users">,
  maxRows = DASHBOARD_BOUNDED_ROW_CAP
): Promise<Doc<"surveys">[]> {
  return ctx.db
    .query("surveys")
    .withIndex("by_surveyor", (q) => q.eq("surveyorId", surveyorId))
    .order("desc")
    .take(maxRows)
}

/** Bounded survey load by municipality (no .paginate — safe when called per-municipality in one query). */
async function loadSurveysByMunicipality(
  ctx: QueryCtx,
  municipalityId: Id<"municipalities">,
  maxRows = DASHBOARD_BOUNDED_ROW_CAP
): Promise<Doc<"surveys">[]> {
  return ctx.db
    .query("surveys")
    .withIndex("by_municipality_status", (q) => q.eq("municipalityId", municipalityId))
    .order("desc")
    .take(maxRows)
}

function toStatsSlice(row: Doc<"surveys">): SurveyStatsSlice {
  return {
    _id: row._id,
    status: row.status,
    qcStatus: row.qcStatus,
    districtId: row.districtId,
    municipalityId: row.municipalityId,
    wardNo: row.wardNo,
    surveyorId: row.surveyorId,
    submittedAt: row.submittedAt,
    _creationTime: row._creationTime,
    city: row.city,
  }
}

/** Municipality ids for accurate dashboard reads (includes ward-narrowed roles). */
async function resolveDashboardMunicipalityIds(
  ctx: QueryCtx,
  me: Doc<"users">,
  precomputed?: PrecomputedFieldContext
): Promise<Id<"municipalities">[]> {
  const access = precomputed?.access ?? (await fieldSurveyAccess(ctx, me))
  if (access === "none") return []

  const scope = precomputed?.scope ?? (await resolveDashboardTenantScope(ctx, me))
  const muniIds = [...tenantMunicipalityIds(scope)]

  if (access === "admin") {
    return scope.municipalities.length > 0 ? scope.municipalities.map((m) => m._id) : muniIds
  }
  if (scope.municipalities.length > 0) return scope.municipalities.map((m) => m._id)
  if (me.municipalityId) return [me.municipalityId]
  return muniIds
}

/** Bounded scoped survey rows for dashboard charts (safe for large tenants). */
export async function loadBoundedScopedSurveyRows(
  ctx: QueryCtx,
  me: Doc<"users">,
  maxRows = DASHBOARD_BOUNDED_ROW_CAP
): Promise<Doc<"surveys">[]> {
  const access = await fieldSurveyAccess(ctx, me)
  const muniIds = tenantMunicipalityIds(await resolveDashboardTenantScope(ctx, me))

  if (access === "own") {
    const rows = await ctx.db
      .query("surveys")
      .withIndex("by_surveyor", (q) => q.eq("surveyorId", me._id))
      .order("desc")
      .take(maxRows)
    return rows.filter((r) => muniIds.has(r.municipalityId) && canReadWard(me, r.municipalityId, r.wardNo))
  }

  const scopedMunis = await resolveDashboardMunicipalityIds(ctx, me)
  if (scopedMunis.length === 0) return []

  // Cap ULB fan-out — prefer rollup paths; this is fallback for filtered charts only.
  const targetMunis = scopedMunis.slice(0, DASHBOARD_FANOUT_ULB_CAP)

  // Before: sequential await per municipality (O(M) wall time).
  // After: parallel indexed takes; merge until maxRows.
  const perMuniTake = Math.min(maxRows, Math.ceil(maxRows / Math.max(targetMunis.length, 1)) + 20)
  const batches = await Promise.all(
    targetMunis.map((municipalityId) =>
      ctx.db
        .query("surveys")
        .withIndex("by_municipality_status", (q) => q.eq("municipalityId", municipalityId))
        .take(perMuniTake)
    )
  )

  const seen = new Set<string>()
  const rows: Doc<"surveys">[] = []
  for (const batch of batches) {
    for (const row of batch) {
      if (seen.has(row._id)) continue
      if (!muniIds.has(row.municipalityId)) continue
      if (!canReadWard(me, row.municipalityId, row.wardNo)) continue
      seen.add(row._id)
      rows.push(row)
      if (rows.length >= maxRows) return rows
    }
  }

  return rows
}

/** @deprecated Use `loadBoundedScopedSurveyRows` — full collect exceeds Convex limits in production. */
export async function loadLiveScopedSurveyRows(ctx: QueryCtx, me: Doc<"users">): Promise<Doc<"surveys">[]> {
  return loadBoundedScopedSurveyRows(ctx, me)
}

/** True when KPIs must be computed from ward-filtered live rows (stats tables are municipality-wide). */
function userRequiresWardScopedSurveyCounts(me: Doc<"users">): boolean {
  if (me.role === "admin" || me.role === "supervisor") return false
  return me.wardAssignments.length > 0
}

type DashboardCountPart = {
  total: number
  today: number
  drafts: number
  pending: number
  submittedToday: number
  approved: number
  submitted: number
  rejected: number
}

function emptyDashboardCountPart(): DashboardCountPart {
  return {
    total: 0,
    today: 0,
    drafts: 0,
    pending: 0,
    submittedToday: 0,
    approved: 0,
    submitted: 0,
    rejected: 0,
  }
}

function mergeDashboardCountParts(parts: DashboardCountPart[]): DashboardCounts {
  return parts.reduce(
    (acc, part) => ({
      total: acc.total + part.total,
      today: acc.today + part.today,
      drafts: acc.drafts + part.drafts,
      pending: acc.pending + part.pending,
      submittedToday: acc.submittedToday + part.submittedToday,
      approved: acc.approved + part.approved,
      submitted: acc.submitted + part.submitted,
      rejected: acc.rejected + part.rejected,
    }),
    emptyDashboardCountPart()
  )
}

function liveSnapshotToDashboardPart(
  live: MunicipalityStatsRollup & { todayCreated: number; submittedToday: number }
): DashboardCountPart {
  return {
    total: live.total,
    today: live.todayCreated,
    drafts: live.drafts,
    pending: live.qcPending,
    submittedToday: live.submittedToday,
    approved: live.qcApproved,
    submitted: live.submitted,
    rejected: live.qcRejected,
  }
}

async function loadMunicipalityDashboardCounts(
  ctx: QueryCtx,
  me: Doc<"users">,
  municipalityId: Id<"municipalities">,
  todayMs: number,
  wardScoped: boolean,
  allowLiveFallback: boolean
): Promise<DashboardCountPart> {
  if (wardScoped) {
    return loadWardScopedMunicipalityDashboardCounts(ctx, me, municipalityId, todayMs, allowLiveFallback)
  }

  const statsRow = await getLegacyMunicipalityStatsRow(ctx, municipalityId)

  if (statsRow) {
    const rollup: MunicipalityStatsRollup = {
      municipalityId: statsRow.municipalityId,
      total: statsRow.total,
      drafts: statsRow.drafts,
      submitted: statsRow.submitted,
      qcApproved: statsRow.qcApproved,
      qcRejected: statsRow.qcRejected,
      qcPending: statsRow.qcPending,
    }

    if (!municipalityStatsRowLooksConsistent(rollup)) {
      if (!allowLiveFallback) return emptyDashboardCountPart()
      const live = await computeLiveMunicipalitySnapshot(ctx, me, municipalityId, todayMs)
      return liveSnapshotToDashboardPart(live)
    }
    const part: DashboardCountPart = {
      total: statsRow.total,
      today: 0,
      drafts: statsRow.drafts,
      pending: statsRow.qcPending,
      submittedToday: 0,
      approved: statsRow.qcApproved,
      submitted: statsRow.submitted,
      rejected: statsRow.qcRejected,
    }

    const dateKey = formatDateKey(todayMs)
    const dailyRow = await getLegacyDailyStatsRow(ctx, municipalityId, dateKey)

    if (dailyRow) {
      part.today = dailyRow.created
      part.submittedToday = dailyRow.submitted
    }
    // Missing daily row: keep today/submittedToday at 0 — do NOT live-scan 2500 surveys.

    return part
  }

  if (!allowLiveFallback) return emptyDashboardCountPart()
  const live = await computeLiveMunicipalitySnapshot(ctx, me, municipalityId, todayMs)
  return liveSnapshotToDashboardPart(live)
}

/** Ward-scoped home KPIs from surveyWardStats (not full municipality survey scans). */
async function loadWardScopedMunicipalityDashboardCounts(
  ctx: QueryCtx,
  me: Doc<"users">,
  municipalityId: Id<"municipalities">,
  todayMs: number,
  allowLiveFallback: boolean
): Promise<DashboardCountPart> {
  const part = emptyDashboardCountPart()
  const wards = me.wardAssignments.length > 0 ? me.wardAssignments : []

  if (wards.length === 0) {
    if (!allowLiveFallback) return emptyDashboardCountPart()
    const live = await computeLiveMunicipalitySnapshot(ctx, me, municipalityId, todayMs)
    return liveSnapshotToDashboardPart(live)
  }

  let anyRollup = false
  for (const wardNo of wards) {
    const row = await getLegacyWardStatsRow(ctx, municipalityId, wardNo)
    if (!row) continue
    anyRollup = true
    part.total += row.total
    part.drafts += row.drafts
    part.submitted += row.submitted
    part.approved += row.qcApproved
    part.rejected += row.qcRejected
    part.pending += row.qcPending
  }

  if (!anyRollup && allowLiveFallback) {
    const live = await computeLiveMunicipalitySnapshot(ctx, me, municipalityId, todayMs)
    return liveSnapshotToDashboardPart(live)
  }

  // No ward-daily rollup — leave today/submittedToday at 0 rather than scanning surveys.
  return part
}

/**
 * Surveyor home KPIs from surveySurveyorStats + capped today scan.
 * Before: always take(2500) full survey docs → UserTimeout under load.
 */
async function loadSurveyorDashboardCounts(ctx: QueryCtx, me: Doc<"users">, todayMs: number): Promise<DashboardCounts> {
  const muniIds = tenantMunicipalityIds(await resolveDashboardTenantScope(ctx, me))
  const statsRows = filterLegacyAnalyticsRows(
    await ctx.db
      .query("surveySurveyorStats")
      .withIndex("by_surveyor", (q) => q.eq("surveyorId", me._id))
      .take(64)
  )

  let total = 0
  let drafts = 0
  let submitted = 0
  let approved = 0
  let rejected = 0
  for (const row of statsRows) {
    if (!muniIds.has(row.municipalityId)) continue
    total += row.total
    drafts += row.drafts
    submitted += row.submitted
    approved += row.qcApproved
    rejected += row.qcRejected
  }
  const pending = Math.max(0, submitted - approved - rejected)

  const dayEnd = dayEndMs(todayMs)
  const recent = await loadSurveysBySurveyor(ctx, me._id, DASHBOARD_SURVEYOR_TODAY_CAP)
  const scopedRecent = recent.filter(
    (r) => muniIds.has(r.municipalityId) && canReadWard(me, r.municipalityId, r.wardNo)
  )

  // Cold rollups: derive all KPIs from the capped recent slice (degraded but fast).
  if (statsRows.length === 0) {
    return computeDashboardCountsFromSlice(scopedRecent.map(toStatsSlice), todayMs)
  }

  let today = 0
  let submittedToday = 0
  for (const row of scopedRecent) {
    if (row._creationTime >= todayMs && row._creationTime < dayEnd) today += 1
    if (row.status !== "draft") {
      const submittedTs = row.submittedAt ?? row._creationTime
      if (submittedTs >= todayMs && submittedTs < dayEnd) submittedToday += 1
    }
  }

  return {
    total,
    today,
    drafts,
    pending,
    submittedToday,
    approved,
    submitted,
    rejected,
  }
}

/** Home dashboard KPIs: accurate per-municipality stats with live fallback for gaps. */
export async function loadDashboardCountsForHome(
  ctx: QueryCtx,
  me: Doc<"users">,
  todayMs: number
): Promise<DashboardCounts> {
  const access = await fieldSurveyAccess(ctx, me)
  if (access === "none" || me.status !== "active") {
    return emptyDashboardCountPart()
  }

  if (access === "own") {
    return loadSurveyorDashboardCounts(ctx, me, todayMs)
  }

  const scopedMuniIds = await resolveDashboardMunicipalityIds(ctx, me)
  if (scopedMuniIds.length === 0) {
    return emptyDashboardCountPart()
  }

  const wardScoped = userRequiresWardScopedSurveyCounts(me)
  const allowLiveFallback = mayUseLiveMunicipalityFallback(me, scopedMuniIds.length, wardScoped)

  // Large scopes: batch municipality + today daily stats (avoid N×2 point lookups).
  if (!wardScoped && scopedMuniIds.length > STATS_BATCH_SCOPE_THRESHOLD) {
    const dateKey = formatDateKey(todayMs)
    const [rollups, todayByMuni] = await Promise.all([
      loadMunicipalityStatsRollupsResilient(ctx, me, scopedMuniIds, todayMs),
      loadTodayCreatedByMunicipality(ctx, scopedMuniIds, dateKey),
    ])
    const parts = rollups.map((row) => {
      const daily = todayByMuni.get(row.municipalityId)
      return {
        total: row.total,
        today: daily?.created ?? 0,
        drafts: row.drafts,
        pending: row.qcPending,
        submittedToday: daily?.submitted ?? 0,
        approved: row.qcApproved,
        submitted: row.submitted,
        rejected: row.qcRejected,
      } satisfies DashboardCountPart
    })
    return mergeDashboardCountParts(parts)
  }

  // Sequential ULB reads — parallel fan-out contended with SQLite on self-hosted.
  const parts: DashboardCountPart[] = []
  for (const municipalityId of scopedMuniIds) {
    parts.push(await loadMunicipalityDashboardCounts(ctx, me, municipalityId, todayMs, wardScoped, allowLiveFallback))
  }

  return mergeDashboardCountParts(parts)
}

/** Accurate dashboard KPI counts from live survey rows in tenant scope. */
export async function loadDashboardCountsFromLiveScope(
  ctx: QueryCtx,
  me: Doc<"users">,
  todayMs: number
): Promise<DashboardCounts> {
  return loadDashboardCountsForHome(ctx, me, todayMs)
}

export function liveScopedStatsSlices(rows: Doc<"surveys">[]): SurveyStatsSlice[] {
  return rows.map(toStatsSlice)
}

/** QC approve/reject counts per day from decision records (no full survey scan). */
async function loadDailyQcTrendFromDecisions(
  ctx: QueryCtx,
  me: Doc<"users">,
  days: number,
  nowMs: number,
  precomputed?: PrecomputedFieldContext,
  municipalityIds?: Id<"municipalities">[]
): Promise<Map<string, { approved: number; rejected: number }>> {
  const safeDays = Math.min(Math.max(days, 1), 180)
  const scopedMunis = municipalityIds ?? (await resolveDashboardMunicipalityIds(ctx, me, precomputed))
  const { startMs, buckets } = istTrendBuckets(safeDays, nowMs, () => ({ approved: 0, rejected: 0 }))

  if (scopedMunis.length === 0) return buckets

  // Cap ULB fan-out so admin home cannot exceed syscall / document-scan budgets.
  // Remaining ULBs omit QC series points (created/submitted still accurate from daily stats).
  const targetMunis = scopedMunis.slice(0, DASHBOARD_FANOUT_ULB_CAP)

  // Sequential per-ULB reads — parallel fan-out contended with daily-stats streams on SQLite.
  for (const municipalityId of targetMunis) {
    const decisions = await ctx.db
      .query("qcDecisions")
      .withIndex("by_municipality_decided", (q) => q.eq("municipalityId", municipalityId).gte("decidedAt", startMs))
      .take(DASHBOARD_QC_TREND_DECISIONS_CAP)

    for (const decision of decisions) {
      const bucket = buckets.get(formatDateKey(decision.decidedAt))
      if (!bucket) continue
      if (decision.decision === "approve") bucket.approved += 1
      else if (decision.decision === "reject") bucket.rejected += 1
    }
  }

  return buckets
}

/**
 * Full daily trend: created/submitted from stats tables, QC from decision records.
 *
 * Runs base trend then QC sequentially (not Promise.all) to avoid SQLite stream contention.
 */
export async function loadDashboardDailyTrend(
  ctx: QueryCtx,
  me: Doc<"users">,
  days: number,
  nowMs: number,
  precomputed?: PrecomputedFieldContext
): Promise<Array<{ date: string; created: number; submitted: number; approved: number; rejected: number }>> {
  const municipalityIds = await resolveDashboardMunicipalityIds(ctx, me, precomputed)
  const baseTrend = await loadDailyTrendFromDailyStats(ctx, me, days, nowMs, undefined, precomputed, municipalityIds)
  const qcBuckets = await loadDailyQcTrendFromDecisions(ctx, me, days, nowMs, precomputed, municipalityIds)

  return baseTrend.map((point) => {
    const qc = qcBuckets.get(point.date)
    return {
      ...point,
      approved: qc?.approved ?? point.approved,
      rejected: qc?.rejected ?? point.rejected,
    }
  })
}

/**
 * Daily created/submitted trend from denormalized daily stats.
 *
 * Before: large scopes ran Promise.all(days × take(2000) by_date) — concurrent queryStreamNext
 * saturation and SystemTimeout. Small scopes used N×D point lookups which still timed out
 * for admin scopes (e.g. 80 ULBs × 30 days).
 * After: small scopes use chunked point lookups; large scopes use sequential by_date takes.
 */
export async function loadDailyTrendFromDailyStats(
  ctx: QueryCtx,
  me: Doc<"users">,
  days: number,
  nowMs: number,
  qcRows?: SurveyStatsSlice[],
  precomputed?: PrecomputedFieldContext,
  municipalityIds?: Id<"municipalities">[]
): Promise<Array<{ date: string; created: number; submitted: number; approved: number; rejected: number }>> {
  const scopedMunis = municipalityIds ?? (await resolveDashboardMunicipalityIds(ctx, me, precomputed))
  const safeDays = Math.min(Math.max(days, 1), 180)
  const { buckets } = istTrendBuckets(safeDays, nowMs, () => ({
    created: 0,
    submitted: 0,
    approved: 0,
    rejected: 0,
  }))

  if (scopedMunis.length === 0) {
    return [...buckets.entries()].map(([date, bucket]) => ({ date, ...bucket }))
  }

  const dateKeys = [...buckets.keys()].sort()
  const scopedSet = new Set(scopedMunis)

  // Large admin scopes: N ULBs × D days of point lookups still hits syscall budgets
  // (e.g. 80×30 ≈ 2400 indexed reads → SystemTimeout → isolate restart under load).
  // One sequential by_date take per day (filter in memory) keeps accuracy for all ULBs
  // without parallel queryStreamNext stampede.
  if (scopedMunis.length > STATS_BATCH_SCOPE_THRESHOLD) {
    for (const dateKey of dateKeys) {
      const bucket = buckets.get(dateKey)
      if (!bucket) continue
      const dayRows = await loadLegacyDailyStatsForDate(ctx, dateKey)
      for (const row of dayRows) {
        if (!scopedSet.has(row.municipalityId)) continue
        bucket.created += row.created
        bucket.submitted += row.submitted
      }
    }
  } else {
    // Small scopes: chunked parallel point lookups (take(16) each).
    const POINT_LOOKUP_CHUNK = 20
    for (const dateKey of dateKeys) {
      const bucket = buckets.get(dateKey)
      if (!bucket) continue
      for (let i = 0; i < scopedMunis.length; i += POINT_LOOKUP_CHUNK) {
        const chunk = scopedMunis.slice(i, i + POINT_LOOKUP_CHUNK)
        const dailyRows = await Promise.all(
          chunk.map((municipalityId) => getLegacyDailyStatsRow(ctx, municipalityId, dateKey))
        )
        for (const row of dailyRows) {
          if (!row) continue
          bucket.created += row.created
          bucket.submitted += row.submitted
        }
      }
    }
  }

  if (qcRows && qcRows.length > 0) {
    const qcTrend = computeDailyTrendFromSlice(qcRows, safeDays, nowMs)
    for (const point of qcTrend) {
      const bucket = buckets.get(point.date)
      if (!bucket) continue
      bucket.approved = point.approved
      bucket.rejected = point.rejected
    }
  }

  return [...buckets.entries()].map(([date, bucket]) => ({ date, ...bucket }))
}

/** Record a newly inserted survey in denormalized stats tables. */
export async function recordSurveyStatsInsert(ctx: MutationCtx, survey: Doc<"surveys">) {
  await recordSurveyAnalyticsInsert(ctx, survey)
}

/** Remove a deleted survey from denormalized stats tables. */
export async function recordSurveyStatsRemove(ctx: MutationCtx, survey: Doc<"surveys">) {
  await recordSurveyAnalyticsRemove(ctx, survey)
}

/** Apply a survey update that may change status, qcStatus, or municipality. */
export async function recordSurveyStatsUpdate(ctx: MutationCtx, before: Doc<"surveys">, after: Doc<"surveys">) {
  await recordSurveyAnalyticsUpdate(ctx, before, after)
}

export type ScopeStatsFilters = {
  districtId?: Id<"districts">
  municipalityId?: Id<"municipalities">
  status?: Doc<"surveys">["status"]
  qcStatus?: Doc<"surveys">["qcStatus"]
}

export type MunicipalityStatsRollup = {
  municipalityId: Id<"municipalities">
  total: number
  drafts: number
  submitted: number
  qcApproved: number
  qcRejected: number
  qcPending: number
}

/** True when denormalized municipality stats satisfy dashboard invariants. */
export function municipalityStatsRowLooksConsistent(row: MunicipalityStatsRollup): boolean {
  const statusSum = row.drafts + row.qcPending + row.qcApproved + row.qcRejected
  if (row.total < statusSum) return false
  if (row.drafts > row.total) return false
  if (row.submitted > row.total) return false
  return true
}

export type ScopeStatsSummary = MunicipalityStatsRollup & {
  submittedToday: number
  todayCreated: number
}

/** True when denormalized municipality stats can answer the query without scanning surveys. */
export function scopeStatsFastPathEligible(filters: {
  wardNo?: string
  fromMs?: number
  toMs?: number
  status?: Doc<"surveys">["status"]
  qcStatus?: Doc<"surveys">["qcStatus"]
  qcStatuses?: Doc<"surveys">["qcStatus"][]
  surveyorId?: Id<"users">
  searchTerm?: string
}): boolean {
  if (filters.wardNo) return false
  if (filters.fromMs !== undefined || filters.toMs !== undefined) return false
  if (filters.surveyorId) return false
  if (filters.searchTerm?.trim()) return false
  if (filters.qcStatuses && filters.qcStatuses.length > 0) return false
  return true
}

function rollupFieldForListFilters(filters: ScopeStatsFilters): keyof MunicipalityStatsRollup | "total" {
  if (filters.status === "draft") return "drafts"
  if (filters.status === "submitted") return "submitted"
  if (filters.qcStatus === "approved") return "qcApproved"
  if (filters.qcStatus === "rejected") return "qcRejected"
  if (filters.qcStatus === "pending") return "qcPending"
  return "total"
}

function countFromMunicipalityRollup(row: MunicipalityStatsRollup, filters: ScopeStatsFilters): number {
  const field = rollupFieldForListFilters(filters)
  switch (field) {
    case "total":
      return row.total
    case "drafts":
      return row.drafts
    case "submitted":
      return row.submitted
    case "qcApproved":
      return row.qcApproved
    case "qcRejected":
      return row.qcRejected
    case "qcPending":
      return row.qcPending
    default:
      return row.total
  }
}

/** Live municipality snapshot — capped to avoid UserTimeout on home KPIs. */
async function computeLiveMunicipalitySnapshot(
  ctx: QueryCtx,
  me: Doc<"users">,
  municipalityId: Id<"municipalities">,
  todayMs: number
): Promise<MunicipalityStatsRollup & { todayCreated: number; submittedToday: number }> {
  const muniIds = tenantMunicipalityIds(await resolveDashboardTenantScope(ctx, me))
  const dayEnd = dayEndMs(todayMs)
  const rows = await loadSurveysByMunicipality(ctx, municipalityId, DASHBOARD_LIVE_FALLBACK_ROW_CAP)

  const rollup: MunicipalityStatsRollup & { todayCreated: number; submittedToday: number } = {
    municipalityId,
    total: 0,
    drafts: 0,
    submitted: 0,
    qcApproved: 0,
    qcRejected: 0,
    qcPending: 0,
    todayCreated: 0,
    submittedToday: 0,
  }

  for (const row of rows) {
    if (!muniIds.has(row.municipalityId)) continue
    if (!canReadWard(me, row.municipalityId, row.wardNo)) continue

    rollup.total += 1
    if (row.status === "draft") rollup.drafts += 1
    if (row.status === "submitted") rollup.submitted += 1
    if (row.qcStatus === "approved") rollup.qcApproved += 1
    if (row.qcStatus === "rejected") rollup.qcRejected += 1
    if (row.qcStatus === "pending" && row.status === "submitted") rollup.qcPending += 1

    if (row._creationTime >= todayMs && row._creationTime < dayEnd) rollup.todayCreated += 1
    if (row.status !== "draft") {
      const submittedTs = row.submittedAt ?? row._creationTime
      if (submittedTs >= todayMs && submittedTs < dayEnd) rollup.submittedToday += 1
    }
  }

  return rollup
}

/**
 * Load municipality stats rollups with optional live fallback.
 *
 * Before: sequential per-ULB; missing stats → live take(2500) each (timeout on admin).
 * After: parallel indexed reads for small scopes; batched for large scopes;
 * live only when scope ≤ DASHBOARD_LIVE_FALLBACK_ULB_CAP.
 * Missing daily stats return today=0 — do not live-scan surveys for today metrics.
 */
async function loadMunicipalityStatsRollupsResilient(
  ctx: QueryCtx,
  me: Doc<"users">,
  scopedMuniIds: Id<"municipalities">[],
  todayMs: number
): Promise<MunicipalityStatsRollup[]> {
  const wardScoped = userRequiresWardScopedSurveyCounts(me)
  const allowLiveFallback = mayUseLiveMunicipalityFallback(me, scopedMuniIds.length, wardScoped)
  const todayStart = startOfDayMsFromKey(formatDateKey(todayMs))
  const scopedSet = new Set(scopedMuniIds)

  // Large scopes: indexed point lookups per scoped ULB (never full-table paginate).
  // Before: loadAllLegacyMunicipalityStatsRows streamed every generation row → queryStreamNext timeouts.
  if (!wardScoped && scopedMuniIds.length > STATS_BATCH_SCOPE_THRESHOLD) {
    const allRows = await loadLegacyMunicipalityStatsForMunicipalities(ctx, scopedMuniIds)
    const byMuni = new Map<Id<"municipalities">, MunicipalityStatsRollup>()
    for (const row of allRows) {
      if (!scopedSet.has(row.municipalityId)) continue
      const rollup: MunicipalityStatsRollup = {
        municipalityId: row.municipalityId,
        total: row.total,
        drafts: row.drafts,
        submitted: row.submitted,
        qcApproved: row.qcApproved,
        qcRejected: row.qcRejected,
        qcPending: row.qcPending,
      }
      if (municipalityStatsRowLooksConsistent(rollup)) {
        byMuni.set(row.municipalityId, rollup)
      }
    }

    return scopedMuniIds.map((municipalityId) => byMuni.get(municipalityId) ?? emptyMunicipalityRollup(municipalityId))
  }

  const results = await Promise.all(
    scopedMuniIds.map(async (municipalityId) => {
      if (!wardScoped) {
        const row = await getLegacyMunicipalityStatsRow(ctx, municipalityId)
        if (row) {
          const rollup: MunicipalityStatsRollup = {
            municipalityId: row.municipalityId,
            total: row.total,
            drafts: row.drafts,
            submitted: row.submitted,
            qcApproved: row.qcApproved,
            qcRejected: row.qcRejected,
            qcPending: row.qcPending,
          }
          if (municipalityStatsRowLooksConsistent(rollup)) {
            return rollup
          }
        }
      }

      if (!allowLiveFallback) {
        return emptyMunicipalityRollup(municipalityId)
      }

      const live = await computeLiveMunicipalitySnapshot(ctx, me, municipalityId, todayStart)
      return {
        municipalityId: live.municipalityId,
        total: live.total,
        drafts: live.drafts,
        submitted: live.submitted,
        qcApproved: live.qcApproved,
        qcRejected: live.qcRejected,
        qcPending: live.qcPending,
      }
    })
  )

  return results
}

/** Municipality ids visible for stats rollups, optionally narrowed by district / ULB filters. */
export async function resolveScopedMunicipalityIds(
  ctx: QueryCtx,
  me: Doc<"users">,
  filters: Pick<ScopeStatsFilters, "districtId" | "municipalityId"> = {},
  precomputed?: PrecomputedFieldContext
): Promise<Id<"municipalities">[] | null> {
  const access = precomputed?.access ?? (await fieldSurveyAccess(ctx, me))
  if (access === "none" || access === "own") return null

  const scope = precomputed?.scope ?? (await resolveTenantScope(ctx, me))
  let scopedMuniIds = await resolveDashboardMunicipalityIds(ctx, me, precomputed ?? { scope, access })

  if (filters.municipalityId) {
    if (!scopedMuniIds.includes(filters.municipalityId)) return null
    scopedMuniIds = [filters.municipalityId]
  } else if (filters.districtId) {
    const districtMunis = scope.municipalities.filter((m) => m.districtId === filters.districtId).map((m) => m._id)
    scopedMuniIds = scopedMuniIds.filter((id) => districtMunis.includes(id))
  }

  return scopedMuniIds.length > 0 ? scopedMuniIds : null
}

/** Average survey completion % from denormalized municipality stats (no survey scan). */
export async function loadScopeCompletionPct(
  ctx: QueryCtx,
  me: Doc<"users">,
  filters: ScopeStatsFilters = {},
  precomputed?: PrecomputedFieldContext
): Promise<number | null> {
  const scopedMuniIds = await resolveScopedMunicipalityIds(ctx, me, filters, precomputed)
  if (!scopedMuniIds) return null

  let sum = 0
  let count = 0
  const rows = await Promise.all(
    scopedMuniIds.map((municipalityId) => getLegacyMunicipalityStatsRow(ctx, municipalityId))
  )

  for (const row of rows) {
    if (!row) return null
    sum += row.completionPctSum ?? 0
    count += row.completionPctCount ?? 0
  }

  if (count === 0) return 0
  return Math.round(sum / count)
}

async function loadMunicipalityStatsRollups(
  ctx: QueryCtx,
  me: Doc<"users">,
  scopedMuniIds: Id<"municipalities">[],
  todayMs: number
): Promise<MunicipalityStatsRollup[] | null> {
  if (scopedMuniIds.length === 0) return null
  return loadMunicipalityStatsRollupsResilient(ctx, me, scopedMuniIds, todayMs)
}

/** Fast scoped summary from denormalized municipality + daily stats tables. */
export async function loadScopeStatsSummary(
  ctx: QueryCtx,
  me: Doc<"users">,
  todayMs: number,
  filters: ScopeStatsFilters = {},
  precomputed?: PrecomputedFieldContext
): Promise<ScopeStatsSummary | null> {
  const scopedMuniIds = await resolveScopedMunicipalityIds(ctx, me, filters, precomputed)
  if (!scopedMuniIds) return null

  const rollups = await loadMunicipalityStatsRollups(ctx, me, scopedMuniIds, todayMs)
  if (!rollups) return null

  const dateKey = formatDateKey(todayMs)
  const todayByMuni = await loadTodayCreatedByMunicipality(ctx, scopedMuniIds, dateKey)

  const totals: ScopeStatsSummary = {
    municipalityId: scopedMuniIds[0]!,
    total: 0,
    drafts: 0,
    submitted: 0,
    qcApproved: 0,
    qcRejected: 0,
    qcPending: 0,
    submittedToday: 0,
    todayCreated: 0,
  }

  for (const row of rollups) {
    totals.total += countFromMunicipalityRollup(row, filters)
    totals.drafts += row.drafts
    totals.submitted += row.submitted
    totals.qcApproved += row.qcApproved
    totals.qcRejected += row.qcRejected
    totals.qcPending += row.qcPending
  }

  for (const municipalityId of scopedMuniIds) {
    if (userRequiresWardScopedSurveyCounts(me)) {
      // Ward-scoped today metrics: leave at 0 rather than live-scanning full ULB surveys.
      continue
    }

    const daily = todayByMuni.get(municipalityId)
    if (daily) {
      totals.todayCreated += daily.created
      totals.submittedToday += daily.submitted
    }
    // Missing daily row: keep zeros — do not live-scan surveys for today metrics.
  }

  return totals
}

/**
 * Load today's daily stats for a set of ULBs.
 * Large scopes: one by_date index read; small scopes: parallel point reads.
 */
async function loadTodayCreatedByMunicipality(
  ctx: QueryCtx,
  scopedMuniIds: Id<"municipalities">[],
  dateKey: string
): Promise<Map<Id<"municipalities">, { created: number; submitted: number }>> {
  const result = new Map<Id<"municipalities">, { created: number; submitted: number }>()
  if (scopedMuniIds.length === 0) return result

  if (scopedMuniIds.length > STATS_BATCH_SCOPE_THRESHOLD) {
    const scopedSet = new Set(scopedMuniIds)
    const rows = await loadLegacyDailyStatsForDate(ctx, dateKey)
    for (const row of rows) {
      if (!scopedSet.has(row.municipalityId)) continue
      result.set(row.municipalityId, { created: row.created, submitted: row.submitted })
    }
    return result
  }

  const dailyStats = await Promise.all(
    scopedMuniIds.map((municipalityId) => getLegacyDailyStatsRow(ctx, municipalityId, dateKey))
  )
  for (let index = 0; index < scopedMuniIds.length; index++) {
    const row = dailyStats[index]
    if (row) {
      result.set(scopedMuniIds[index]!, { created: row.created, submitted: row.submitted })
    }
  }
  return result
}

/** Total list rows matching filters without scanning surveys (when eligible). */
export async function resolveListTotalFromStats(
  ctx: QueryCtx,
  me: Doc<"users">,
  nowMs: number,
  filters: ScopeStatsFilters
): Promise<number | null> {
  const summary = await loadScopeStatsSummary(ctx, me, nowMs, filters)
  if (!summary) return null
  return summary.total
}

/** District / ULB breakdown tables from denormalized stats (no survey row scan). */
export async function loadAnalyticsBreakdownFromStats(
  ctx: QueryCtx,
  me: Doc<"users">,
  todayMs: number,
  scope: { districts: Doc<"districts">[]; municipalities: Doc<"municipalities">[] },
  filters: ScopeStatsFilters = {},
  precomputed?: PrecomputedFieldContext
): Promise<{
  summary: SurveyCounts
  byDistrict: Array<{
    districtId: Id<"districts">
    code: string
    name: string
    total: number
    today: number
    drafts: number
    submitted: number
    approved: number
    rejected: number
  }>
  byUlb: Array<{
    municipalityId: Id<"municipalities">
    code: string
    name: string
    districtId: Id<"districts">
    districtName: string
    total: number
    today: number
    drafts: number
    submitted: number
    approved: number
    rejected: number
  }>
} | null> {
  const scopedMuniIds = await resolveScopedMunicipalityIds(ctx, me, filters, precomputed)
  if (!scopedMuniIds) return null

  const rollups = await loadMunicipalityStatsRollups(ctx, me, scopedMuniIds, todayMs)
  if (!rollups) return null

  const dateKey = formatDateKey(todayMs)
  const todayByMuniDaily = await loadTodayCreatedByMunicipality(ctx, scopedMuniIds, dateKey)
  const todayByMuni = new Map<Id<"municipalities">, number>()
  for (const municipalityId of scopedMuniIds) {
    todayByMuni.set(municipalityId, todayByMuniDaily.get(municipalityId)?.created ?? 0)
  }

  const districtMap = new Map(scope.districts.map((d) => [d._id, d]))
  const muniMap = new Map(scope.municipalities.map((m) => [m._id, m]))

  const byUlb = rollups
    .map((row) => {
      const m = muniMap.get(row.municipalityId)
      const d = m ? districtMap.get(m.districtId) : undefined
      const districtId = m?.districtId ?? scope.districts[0]?._id
      if (!districtId) return null
      return {
        municipalityId: row.municipalityId,
        code: m?.code ?? "—",
        name: m?.name ?? "Unknown ULB",
        districtId,
        districtName: d?.name ?? "—",
        total: countFromMunicipalityRollup(row, filters),
        today: todayByMuni.get(row.municipalityId) ?? 0,
        drafts: row.drafts,
        submitted: row.submitted,
        approved: row.qcApproved,
        rejected: row.qcRejected,
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => a.name.localeCompare(b.name))

  const byDistrictGroups = new Map<
    Id<"districts">,
    { total: number; today: number; drafts: number; submitted: number; approved: number; rejected: number }
  >()
  for (const row of byUlb) {
    const bucket = byDistrictGroups.get(row.districtId) ?? {
      total: 0,
      today: 0,
      drafts: 0,
      submitted: 0,
      approved: 0,
      rejected: 0,
    }
    bucket.total += row.total
    bucket.today += row.today
    bucket.drafts += row.drafts
    bucket.submitted += row.submitted
    bucket.approved += row.approved
    bucket.rejected += row.rejected
    byDistrictGroups.set(row.districtId, bucket)
  }

  const byDistrict = [...byDistrictGroups.entries()]
    .map(([districtId, counts]) => {
      const d = districtMap.get(districtId)
      return {
        districtId,
        code: d?.code ?? "—",
        name: d?.name ?? "Unknown district",
        ...counts,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const summary = byUlb.reduce<SurveyCounts>(
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

  return { summary, byDistrict, byUlb }
}

/** Fast dashboard KPI counts from denormalized tables with live fallback for gaps. */
export async function loadDashboardCountsFromStats(
  ctx: QueryCtx,
  me: Doc<"users">,
  todayMs: number
): Promise<DashboardCounts | null> {
  return loadDashboardCountsForHome(ctx, me, todayMs)
}
