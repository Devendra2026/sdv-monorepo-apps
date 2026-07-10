import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { dayEndMs, formatDateKey, startOfDayMs, startOfDayMsFromKey } from "../shared/calendar"
import { fieldSurveyAccess } from "../shared/fieldAccess"
import { canReadWard } from "../shared/helpers"
import {
  resolveDashboardTenantScope,
  resolveTenantScope,
  tenantDistrictIds,
  tenantMunicipalityIds,
} from "../shared/tenancy"
import {
  recordWardSurveyorStatsInsert,
  recordWardSurveyorStatsRemove,
  recordWardSurveyorStatsUpdate,
} from "./surveyRollupStats"
import {
  computeDailyTrendFromSlice,
  computeDashboardCountsFromSlice,
  type DashboardCounts,
  type SurveyCounts,
  type SurveyStatsSlice,
} from "./surveyStatsAggregate"

/** Max survey documents loaded for dashboard analytics fallbacks (avoids Convex read limits). */
export const DASHBOARD_BOUNDED_ROW_CAP = 2500

const MS_PER_DAY = 86_400_000

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
async function resolveDashboardMunicipalityIds(ctx: QueryCtx, me: Doc<"users">): Promise<Id<"municipalities">[]> {
  const access = await fieldSurveyAccess(ctx, me)
  if (access === "none") return []

  const scope = await resolveDashboardTenantScope(ctx, me)
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

  const seen = new Set<string>()
  const rows: Doc<"surveys">[] = []

  for (const municipalityId of scopedMunis) {
    if (rows.length >= maxRows) break
    const remaining = maxRows - rows.length
    const batch = await ctx.db
      .query("surveys")
      .withIndex("by_municipality_status", (q) => q.eq("municipalityId", municipalityId))
      .take(remaining)
    for (const row of batch) {
      if (seen.has(row._id)) continue
      if (!muniIds.has(row.municipalityId)) continue
      if (!canReadWard(me, row.municipalityId, row.wardNo)) continue
      seen.add(row._id)
      rows.push(row)
      if (rows.length >= maxRows) break
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
  wardScoped: boolean
): Promise<DashboardCountPart> {
  if (wardScoped) {
    const live = await computeLiveMunicipalitySnapshot(ctx, me, municipalityId, todayMs)
    return liveSnapshotToDashboardPart(live)
  }

  const statsRow = await ctx.db
    .query("surveyMunicipalityStats")
    .withIndex("by_municipality", (q) => q.eq("municipalityId", municipalityId))
    .unique()

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
    const dailyRow = await ctx.db
      .query("surveyDailyStats")
      .withIndex("by_municipality_date", (q) => q.eq("municipalityId", municipalityId).eq("dateKey", dateKey))
      .unique()

    if (dailyRow) {
      part.today = dailyRow.created
      part.submittedToday = dailyRow.submitted
    } else {
      const today = await computeTodayMetricsForMunicipality(ctx, me, municipalityId, todayMs)
      part.today = today.created
      part.submittedToday = today.submitted
    }

    return part
  }

  const live = await computeLiveMunicipalitySnapshot(ctx, me, municipalityId, todayMs)
  return liveSnapshotToDashboardPart(live)
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
    const muniIds = tenantMunicipalityIds(await resolveDashboardTenantScope(ctx, me))
    const rows = await loadSurveysBySurveyor(ctx, me._id)
    const scoped = rows.filter((r) => muniIds.has(r.municipalityId) && canReadWard(me, r.municipalityId, r.wardNo))
    return computeDashboardCountsFromSlice(scoped.map(toStatsSlice), todayMs)
  }

  const scopedMuniIds = await resolveDashboardMunicipalityIds(ctx, me)
  if (scopedMuniIds.length === 0) {
    return emptyDashboardCountPart()
  }

  const wardScoped = userRequiresWardScopedSurveyCounts(me)
  const parts = await Promise.all(
    scopedMuniIds.map((municipalityId) => loadMunicipalityDashboardCounts(ctx, me, municipalityId, todayMs, wardScoped))
  )

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

/** Max QC decisions loaded per reviewer for dashboard daily trend. */
const DASHBOARD_QC_TREND_DECISIONS_CAP = 800

function filterActiveUsersInScope(
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

/** QC approve/reject counts per day from decision records (no full survey scan). */
async function loadDailyQcTrendFromDecisions(
  ctx: QueryCtx,
  me: Doc<"users">,
  days: number,
  nowMs: number
): Promise<Map<string, { approved: number; rejected: number }>> {
  const safeDays = Math.min(Math.max(days, 1), 180)
  const scopedMunis = new Set(await resolveDashboardMunicipalityIds(ctx, me))
  const { startMs, buckets } = istTrendBuckets(safeDays, nowMs, () => ({ approved: 0, rejected: 0 }))

  if (scopedMunis.size === 0) return buckets

  const scope = await resolveDashboardTenantScope(ctx, me)
  const muniIds = tenantMunicipalityIds(scope)
  const districtIds = tenantDistrictIds(scope)

  const activeQcSupervisors = filterActiveUsersInScope(
    await ctx.db
      .query("users")
      .withIndex("by_role_status", (q) => q.eq("role", "qc_supervisor").eq("status", "active"))
      .collect(),
    muniIds,
    districtIds
  )

  for (const reviewer of activeQcSupervisors) {
    const decisions = await ctx.db
      .query("qcDecisions")
      .withIndex("by_reviewer_decided", (q) => q.eq("reviewerId", reviewer._id).gte("decidedAt", startMs))
      .take(DASHBOARD_QC_TREND_DECISIONS_CAP)

    for (const decision of decisions) {
      const municipalityId = decision.municipalityId
      if (!municipalityId || !scopedMunis.has(municipalityId)) continue
      const bucket = buckets.get(formatDateKey(decision.decidedAt))
      if (!bucket) continue
      if (decision.decision === "approve") bucket.approved += 1
      else bucket.rejected += 1
    }
  }

  return buckets
}

/** Full daily trend: created/submitted from stats tables, QC from decision records. */
export async function loadDashboardDailyTrend(
  ctx: QueryCtx,
  me: Doc<"users">,
  days: number,
  nowMs: number
): Promise<Array<{ date: string; created: number; submitted: number; approved: number; rejected: number }>> {
  const [baseTrend, qcBuckets] = await Promise.all([
    loadDailyTrendFromDailyStats(ctx, me, days, nowMs),
    loadDailyQcTrendFromDecisions(ctx, me, days, nowMs),
  ])

  return baseTrend.map((point) => {
    const qc = qcBuckets.get(point.date)
    return {
      ...point,
      approved: qc?.approved ?? point.approved,
      rejected: qc?.rejected ?? point.rejected,
    }
  })
}

/** Daily created/submitted trend from denormalized daily stats (full history, no row cap). */
export async function loadDailyTrendFromDailyStats(
  ctx: QueryCtx,
  me: Doc<"users">,
  days: number,
  nowMs: number,
  qcRows?: SurveyStatsSlice[]
): Promise<Array<{ date: string; created: number; submitted: number; approved: number; rejected: number }>> {
  const scopedMunis = await resolveDashboardMunicipalityIds(ctx, me)
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

  await Promise.all(
    scopedMunis.map(async (municipalityId) => {
      for (const dateKey of buckets.keys()) {
        const row = await ctx.db
          .query("surveyDailyStats")
          .withIndex("by_municipality_date", (q) => q.eq("municipalityId", municipalityId).eq("dateKey", dateKey))
          .unique()
        if (!row) continue
        const bucket = buckets.get(dateKey)
        if (!bucket) continue
        bucket.created += row.created
        bucket.submitted += row.submitted
      }
    })
  )

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

type SurveySnapshot = Pick<Doc<"surveys">, "municipalityId" | "status" | "qcStatus" | "_creationTime" | "submittedAt">

type MunicipalityBucket = {
  total: number
  drafts: number
  submitted: number
  qcApproved: number
  qcRejected: number
  qcPending: number
}

type DailyBucket = {
  created: number
  submitted: number
}

const EMPTY_MUNI_BUCKET: MunicipalityBucket = {
  total: 0,
  drafts: 0,
  submitted: 0,
  qcApproved: 0,
  qcRejected: 0,
  qcPending: 0,
}

function municipalityBucketFor(survey: SurveySnapshot): MunicipalityBucket {
  const bucket = { ...EMPTY_MUNI_BUCKET, total: 1 }
  if (survey.status === "draft") bucket.drafts = 1
  if (survey.status === "submitted") bucket.submitted = 1
  if (survey.qcStatus === "approved") bucket.qcApproved = 1
  if (survey.qcStatus === "rejected") bucket.qcRejected = 1
  if (survey.qcStatus === "pending" && survey.status === "submitted") bucket.qcPending = 1
  return bucket
}

function dailyBucketFor(survey: SurveySnapshot, dateKey: string): DailyBucket {
  const bucket = { created: 0, submitted: 0 }
  const dayStart = startOfDayMsFromKey(dateKey)
  const dayEnd = dayStart + 86_400_000
  if (survey._creationTime >= dayStart && survey._creationTime < dayEnd) bucket.created = 1
  if (survey.status === "submitted") {
    const submittedAt = survey.submittedAt ?? survey._creationTime
    if (submittedAt >= dayStart && submittedAt < dayEnd) bucket.submitted = 1
  }
  return bucket
}

function addMunicipalityBuckets(target: MunicipalityBucket, delta: MunicipalityBucket, sign: 1 | -1) {
  target.total += sign * delta.total
  target.drafts += sign * delta.drafts
  target.submitted += sign * delta.submitted
  target.qcApproved += sign * delta.qcApproved
  target.qcRejected += sign * delta.qcRejected
  target.qcPending += sign * delta.qcPending
}

function addDailyBuckets(target: DailyBucket, delta: DailyBucket, sign: 1 | -1) {
  target.created += sign * delta.created
  target.submitted += sign * delta.submitted
}

async function getOrCreateMunicipalityStats(ctx: MutationCtx, municipalityId: Id<"municipalities">) {
  const existing = await ctx.db
    .query("surveyMunicipalityStats")
    .withIndex("by_municipality", (q) => q.eq("municipalityId", municipalityId))
    .unique()
  if (existing) return existing

  const id = await ctx.db.insert("surveyMunicipalityStats", {
    municipalityId,
    ...EMPTY_MUNI_BUCKET,
  })
  return (await ctx.db.get(id))!
}

async function getOrCreateDailyStats(ctx: MutationCtx, municipalityId: Id<"municipalities">, dateKey: string) {
  const existing = await ctx.db
    .query("surveyDailyStats")
    .withIndex("by_municipality_date", (q) => q.eq("municipalityId", municipalityId).eq("dateKey", dateKey))
    .unique()
  if (existing) return existing

  const id = await ctx.db.insert("surveyDailyStats", {
    municipalityId,
    dateKey,
    created: 0,
    submitted: 0,
  })
  return (await ctx.db.get(id))!
}

async function applyMunicipalityDelta(
  ctx: MutationCtx,
  municipalityId: Id<"municipalities">,
  delta: MunicipalityBucket,
  sign: 1 | -1
) {
  const row = await getOrCreateMunicipalityStats(ctx, municipalityId)
  await ctx.db.patch(row._id, {
    total: Math.max(0, row.total + sign * delta.total),
    drafts: Math.max(0, row.drafts + sign * delta.drafts),
    submitted: Math.max(0, row.submitted + sign * delta.submitted),
    qcApproved: Math.max(0, row.qcApproved + sign * delta.qcApproved),
    qcRejected: Math.max(0, row.qcRejected + sign * delta.qcRejected),
    qcPending: Math.max(0, row.qcPending + sign * delta.qcPending),
  })
}

async function applyDailyDelta(
  ctx: MutationCtx,
  municipalityId: Id<"municipalities">,
  dateKey: string,
  delta: DailyBucket,
  sign: 1 | -1
) {
  const row = await getOrCreateDailyStats(ctx, municipalityId, dateKey)
  await ctx.db.patch(row._id, {
    created: Math.max(0, row.created + sign * delta.created),
    submitted: Math.max(0, row.submitted + sign * delta.submitted),
  })
}

function dateKeysForSurvey(survey: SurveySnapshot): string[] {
  const keys = new Set<string>()
  keys.add(formatDateKey(survey._creationTime))
  if (survey.submittedAt !== undefined) keys.add(formatDateKey(survey.submittedAt))
  return [...keys]
}

async function applyCompletionPctDelta(
  ctx: MutationCtx,
  municipalityId: Id<"municipalities">,
  completionPct: number,
  sign: 1 | -1
) {
  const row = await getOrCreateMunicipalityStats(ctx, municipalityId)
  const sum = (row.completionPctSum ?? 0) + sign * completionPct
  const count = (row.completionPctCount ?? 0) + sign * 1
  await ctx.db.patch(row._id, {
    completionPctSum: Math.max(0, sum),
    completionPctCount: Math.max(0, count),
  })
}

async function applySurveySnapshot(
  ctx: MutationCtx,
  survey: SurveySnapshot & { completionPct?: number },
  sign: 1 | -1
) {
  const muniDelta = municipalityBucketFor(survey)
  await applyMunicipalityDelta(ctx, survey.municipalityId, muniDelta, sign)

  if (survey.completionPct !== undefined) {
    await applyCompletionPctDelta(ctx, survey.municipalityId, survey.completionPct, sign)
  }

  for (const dateKey of dateKeysForSurvey(survey)) {
    const dailyDelta = dailyBucketFor(survey, dateKey)
    if (dailyDelta.created === 0 && dailyDelta.submitted === 0) continue
    await applyDailyDelta(ctx, survey.municipalityId, dateKey, dailyDelta, sign)
  }
}

/** Record a newly inserted survey in denormalized stats tables. */
export async function recordSurveyStatsInsert(ctx: MutationCtx, survey: Doc<"surveys">) {
  await applySurveySnapshot(ctx, survey, 1)
  await recordWardSurveyorStatsInsert(ctx, survey)
}

/** Remove a deleted survey from denormalized stats tables. */
export async function recordSurveyStatsRemove(ctx: MutationCtx, survey: Doc<"surveys">) {
  await applySurveySnapshot(ctx, survey, -1)
  await recordWardSurveyorStatsRemove(ctx, survey)
}

/** Apply a survey update that may change status, qcStatus, or municipality. */
export async function recordSurveyStatsUpdate(ctx: MutationCtx, before: Doc<"surveys">, after: Doc<"surveys">) {
  if (before.municipalityId !== after.municipalityId) {
    await applySurveySnapshot(ctx, before, -1)
    await applySurveySnapshot(ctx, after, 1)
    await recordWardSurveyorStatsUpdate(ctx, before, after)
    return
  }

  const beforeMuni = municipalityBucketFor(before)
  const afterMuni = municipalityBucketFor(after)
  const muniDelta: MunicipalityBucket = { ...EMPTY_MUNI_BUCKET }
  addMunicipalityBuckets(muniDelta, afterMuni, 1)
  addMunicipalityBuckets(muniDelta, beforeMuni, -1)

  if (
    muniDelta.total !== 0 ||
    muniDelta.drafts !== 0 ||
    muniDelta.submitted !== 0 ||
    muniDelta.qcApproved !== 0 ||
    muniDelta.qcRejected !== 0 ||
    muniDelta.qcPending !== 0
  ) {
    await applyMunicipalityDelta(ctx, after.municipalityId, muniDelta, 1)
  }

  const dateKeys = new Set([...dateKeysForSurvey(before), ...dateKeysForSurvey(after)])
  for (const dateKey of dateKeys) {
    const beforeDaily = dailyBucketFor(before, dateKey)
    const afterDaily = dailyBucketFor(after, dateKey)
    const dailyDelta: DailyBucket = { created: 0, submitted: 0 }
    addDailyBuckets(dailyDelta, afterDaily, 1)
    addDailyBuckets(dailyDelta, beforeDaily, -1)
    if (dailyDelta.created === 0 && dailyDelta.submitted === 0) continue
    await applyDailyDelta(ctx, after.municipalityId, dateKey, dailyDelta, 1)
  }

  const beforePct = before.completionPct
  const afterPct = after.completionPct
  if (beforePct !== afterPct) {
    if (beforePct !== undefined) await applyCompletionPctDelta(ctx, after.municipalityId, beforePct, -1)
    if (afterPct !== undefined) await applyCompletionPctDelta(ctx, after.municipalityId, afterPct, 1)
  }

  await recordWardSurveyorStatsUpdate(ctx, before, after)
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

/** Live rollup for one municipality (ward-scoped) when denormalized stats are missing. */
async function computeLiveMunicipalitySnapshot(
  ctx: QueryCtx,
  me: Doc<"users">,
  municipalityId: Id<"municipalities">,
  todayMs: number
): Promise<MunicipalityStatsRollup & { todayCreated: number; submittedToday: number }> {
  const muniIds = tenantMunicipalityIds(await resolveDashboardTenantScope(ctx, me))
  const dayEnd = dayEndMs(todayMs)
  const rows = await loadSurveysByMunicipality(ctx, municipalityId)

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

/** Today-only metrics for one municipality when daily stats row is missing. */
async function computeTodayMetricsForMunicipality(
  ctx: QueryCtx,
  me: Doc<"users">,
  municipalityId: Id<"municipalities">,
  todayMs: number
): Promise<{ created: number; submitted: number }> {
  const snapshot = await computeLiveMunicipalitySnapshot(ctx, me, municipalityId, todayMs)
  return { created: snapshot.todayCreated, submitted: snapshot.submittedToday }
}

async function loadMunicipalityStatsRollupsResilient(
  ctx: QueryCtx,
  me: Doc<"users">,
  scopedMuniIds: Id<"municipalities">[],
  todayMs: number
): Promise<MunicipalityStatsRollup[]> {
  const wardScoped = userRequiresWardScopedSurveyCounts(me)
  const rollups: MunicipalityStatsRollup[] = []

  for (const municipalityId of scopedMuniIds) {
    if (!wardScoped) {
      const row = await ctx.db
        .query("surveyMunicipalityStats")
        .withIndex("by_municipality", (q) => q.eq("municipalityId", municipalityId))
        .unique()
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
          rollups.push(rollup)
          continue
        }
      }
    }

    const live = await computeLiveMunicipalitySnapshot(
      ctx,
      me,
      municipalityId,
      startOfDayMsFromKey(formatDateKey(todayMs))
    )
    rollups.push({
      municipalityId: live.municipalityId,
      total: live.total,
      drafts: live.drafts,
      submitted: live.submitted,
      qcApproved: live.qcApproved,
      qcRejected: live.qcRejected,
      qcPending: live.qcPending,
    })
  }

  return rollups
}

/** Municipality ids visible for stats rollups, optionally narrowed by district / ULB filters. */
export async function resolveScopedMunicipalityIds(
  ctx: QueryCtx,
  me: Doc<"users">,
  filters: Pick<ScopeStatsFilters, "districtId" | "municipalityId"> = {}
): Promise<Id<"municipalities">[] | null> {
  const access = await fieldSurveyAccess(ctx, me)
  if (access === "none" || access === "own") return null

  const scope = await resolveTenantScope(ctx, me)
  let scopedMuniIds = await resolveDashboardMunicipalityIds(ctx, me)

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
  filters: ScopeStatsFilters = {}
): Promise<number | null> {
  const scopedMuniIds = await resolveScopedMunicipalityIds(ctx, me, filters)
  if (!scopedMuniIds) return null

  let sum = 0
  let count = 0
  const rows = await Promise.all(
    scopedMuniIds.map((municipalityId) =>
      ctx.db
        .query("surveyMunicipalityStats")
        .withIndex("by_municipality", (q) => q.eq("municipalityId", municipalityId))
        .unique()
    )
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
  filters: ScopeStatsFilters = {}
): Promise<ScopeStatsSummary | null> {
  const scopedMuniIds = await resolveScopedMunicipalityIds(ctx, me, filters)
  if (!scopedMuniIds) return null

  const rollups = await loadMunicipalityStatsRollups(ctx, me, scopedMuniIds, todayMs)
  if (!rollups) return null

  const dateKey = formatDateKey(todayMs)
  const dailyStats = await Promise.all(
    scopedMuniIds.map((municipalityId) =>
      ctx.db
        .query("surveyDailyStats")
        .withIndex("by_municipality_date", (q) => q.eq("municipalityId", municipalityId).eq("dateKey", dateKey))
        .unique()
    )
  )

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

  for (let index = 0; index < scopedMuniIds.length; index++) {
    const municipalityId = scopedMuniIds[index]!
    if (userRequiresWardScopedSurveyCounts(me)) {
      const today = await computeTodayMetricsForMunicipality(ctx, me, municipalityId, todayMs)
      totals.todayCreated += today.created
      totals.submittedToday += today.submitted
      continue
    }

    const row = dailyStats[index]
    if (row) {
      totals.todayCreated += row.created
      totals.submittedToday += row.submitted
    } else {
      const today = await computeTodayMetricsForMunicipality(ctx, me, municipalityId, todayMs)
      totals.todayCreated += today.created
      totals.submittedToday += today.submitted
    }
  }

  return totals
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
  filters: ScopeStatsFilters = {}
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
  const scopedMuniIds = await resolveScopedMunicipalityIds(ctx, me, filters)
  if (!scopedMuniIds) return null

  const rollups = await loadMunicipalityStatsRollups(ctx, me, scopedMuniIds, todayMs)
  if (!rollups) return null

  const dateKey = formatDateKey(todayMs)
  const dailyStats = await Promise.all(
    scopedMuniIds.map((municipalityId) =>
      ctx.db
        .query("surveyDailyStats")
        .withIndex("by_municipality_date", (q) => q.eq("municipalityId", municipalityId).eq("dateKey", dateKey))
        .unique()
    )
  )
  const todayByMuni = new Map<Id<"municipalities">, number>()
  scopedMuniIds.forEach((municipalityId, index) => {
    todayByMuni.set(municipalityId, dailyStats[index]?.created ?? 0)
  })

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
