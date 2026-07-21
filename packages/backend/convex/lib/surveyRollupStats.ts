import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { fieldSurveyAccess, type PrecomputedFieldContext } from "../shared/fieldAccess"
import { canReadWard } from "../shared/helpers"
import { resolveTenantScope, tenantMunicipalityIds } from "../shared/tenancy"
import { normalizeWardNo } from "./qcWardStats"
import {
  filterLegacyAnalyticsRows,
  getLegacyDailyStatsRow,
  getLegacyMunicipalityStatsRow,
  getLegacySurveyorStatsRow,
  getLegacyWardStatsRow,
} from "./surveyAnalyticsLookups"

/** Max ward rollup rows loaded per municipality (avoids huge ULB collects). */
const WARD_STATS_PER_MUNI_CAP = 400
/** Max surveyor rollup rows loaded per municipality. */
const SURVEYOR_STATS_PER_MUNI_CAP = 500
/**
 * Max municipalities processed for unbounded rollup loads (analytics / command center).
 * Filtered single-ULB / ward paths are uncapped beyond this budget.
 */
const ROLLUP_ULB_CAP = 40

export type WardStatsRollup = {
  municipalityId: Id<"municipalities">
  wardNo: string
  city: string
  total: number
  drafts: number
  submitted: number
  qcApproved: number
  qcRejected: number
  qcPending: number
  activeSurveyorIds: Id<"users">[]
  firstPendingSurveyId?: Id<"surveys">
}

export type SurveyorStatsRollup = {
  surveyorId: Id<"users">
  municipalityId: Id<"municipalities">
  districtId: Id<"districts">
  total: number
  drafts: number
  submitted: number
  qcApproved: number
  qcRejected: number
}

type WardSurveySnapshot = Pick<
  Doc<"surveys">,
  "_id" | "municipalityId" | "wardNo" | "city" | "status" | "qcStatus" | "surveyorId"
>

type SurveyorSurveySnapshot = Pick<
  Doc<"surveys">,
  "surveyorId" | "municipalityId" | "districtId" | "status" | "qcStatus"
>

type WardCounterDelta = {
  total: number
  drafts: number
  submitted: number
  qcApproved: number
  qcRejected: number
  qcPending: number
}

const EMPTY_WARD_DELTA: WardCounterDelta = {
  total: 0,
  drafts: 0,
  submitted: 0,
  qcApproved: 0,
  qcRejected: 0,
  qcPending: 0,
}

type SurveyorCounterDelta = {
  total: number
  drafts: number
  submitted: number
  qcApproved: number
  qcRejected: number
}

const EMPTY_SURVEYOR_DELTA: SurveyorCounterDelta = {
  total: 0,
  drafts: 0,
  submitted: 0,
  qcApproved: 0,
  qcRejected: 0,
}

export function normalizedWardKey(municipalityId: Id<"municipalities">, wardNo: string): string {
  return `${municipalityId}:${normalizeWardNo(wardNo)}`
}

function wardCounterDeltaFor(survey: WardSurveySnapshot): WardCounterDelta {
  if (!survey.wardNo?.trim()) {
    return { ...EMPTY_WARD_DELTA }
  }
  const delta = { ...EMPTY_WARD_DELTA, total: 1 }
  if (survey.status === "draft") delta.drafts = 1
  if (survey.status === "submitted") delta.submitted = 1
  if (survey.qcStatus === "approved") delta.qcApproved = 1
  if (survey.qcStatus === "rejected") delta.qcRejected = 1
  if (survey.qcStatus === "pending" && survey.status === "submitted") delta.qcPending = 1
  return delta
}

function surveyorCounterDeltaFor(survey: SurveyorSurveySnapshot): SurveyorCounterDelta {
  const delta = { ...EMPTY_SURVEYOR_DELTA, total: 1 }
  if (survey.status === "draft") delta.drafts = 1
  if (survey.status === "submitted") delta.submitted = 1
  if (survey.qcStatus === "approved") delta.qcApproved = 1
  if (survey.qcStatus === "rejected") delta.qcRejected = 1
  return delta
}

function isActiveSurveyorOnWard(survey: WardSurveySnapshot): boolean {
  return survey.status === "draft" || survey.status === "submitted"
}

function isPendingSubmitted(survey: WardSurveySnapshot): boolean {
  return survey.qcStatus === "pending" && survey.status === "submitted"
}

function addWardCounters(target: WardCounterDelta, delta: WardCounterDelta, sign: 1 | -1) {
  target.total += sign * delta.total
  target.drafts += sign * delta.drafts
  target.submitted += sign * delta.submitted
  target.qcApproved += sign * delta.qcApproved
  target.qcRejected += sign * delta.qcRejected
  target.qcPending += sign * delta.qcPending
}

function addSurveyorCounters(target: SurveyorCounterDelta, delta: SurveyorCounterDelta, sign: 1 | -1) {
  target.total += sign * delta.total
  target.drafts += sign * delta.drafts
  target.submitted += sign * delta.submitted
  target.qcApproved += sign * delta.qcApproved
  target.qcRejected += sign * delta.qcRejected
}

async function getOrCreateWardStats(
  ctx: MutationCtx,
  municipalityId: Id<"municipalities">,
  wardNo: string,
  city: string
) {
  const normalized = normalizeWardNo(wardNo)
  const existing = await getLegacyWardStatsRow(ctx, municipalityId, wardNo)
  if (existing) return existing

  const id = await ctx.db.insert("surveyWardStats", {
    municipalityId,
    wardNo: normalized,
    city,
    total: 0,
    drafts: 0,
    submitted: 0,
    qcApproved: 0,
    qcRejected: 0,
    qcPending: 0,
    activeSurveyorIds: [],
  })
  return (await ctx.db.get(id))!
}

async function getOrCreateSurveyorStats(ctx: MutationCtx, survey: SurveyorSurveySnapshot) {
  const existing = await getLegacySurveyorStatsRow(ctx, survey.surveyorId, survey.municipalityId)
  if (existing) return existing

  const id = await ctx.db.insert("surveySurveyorStats", {
    surveyorId: survey.surveyorId,
    municipalityId: survey.municipalityId,
    districtId: survey.districtId,
    total: 0,
    drafts: 0,
    submitted: 0,
    qcApproved: 0,
    qcRejected: 0,
  })
  return (await ctx.db.get(id))!
}

function mergeActiveSurveyorIds(
  current: Id<"users">[],
  surveyorId: Id<"users">,
  wasActive: boolean,
  isActive: boolean
): Id<"users">[] {
  const set = new Set(current)
  if (wasActive) set.delete(surveyorId)
  if (isActive) set.add(surveyorId)
  return [...set]
}

function resolveFirstPendingId(
  current: Id<"surveys"> | undefined,
  survey: WardSurveySnapshot,
  wasPending: boolean,
  isPending: boolean
): Id<"surveys"> | undefined {
  if (isPending) {
    if (!current || current > survey._id) return survey._id
    return current
  }
  if (wasPending && current === survey._id) return undefined
  return current
}

async function applyWardSnapshot(ctx: MutationCtx, survey: WardSurveySnapshot, sign: 1 | -1) {
  if (!survey.wardNo?.trim()) return

  const normalized = normalizeWardNo(survey.wardNo)
  const row = await getOrCreateWardStats(ctx, survey.municipalityId, normalized, survey.city)
  const delta = wardCounterDeltaFor(survey)

  const active = isActiveSurveyorOnWard(survey)
  const pending = isPendingSubmitted(survey)

  let activeSurveyorIds = row.activeSurveyorIds
  let firstPendingSurveyId = row.firstPendingSurveyId

  if (sign === 1) {
    activeSurveyorIds = mergeActiveSurveyorIds(row.activeSurveyorIds, survey.surveyorId, false, active)
    firstPendingSurveyId = resolveFirstPendingId(row.firstPendingSurveyId, survey, false, pending)
  } else {
    activeSurveyorIds = mergeActiveSurveyorIds(row.activeSurveyorIds, survey.surveyorId, active, false)
    firstPendingSurveyId = resolveFirstPendingId(row.firstPendingSurveyId, survey, pending, false)
  }

  await ctx.db.patch(row._id, {
    total: Math.max(0, row.total + sign * delta.total),
    drafts: Math.max(0, row.drafts + sign * delta.drafts),
    submitted: Math.max(0, row.submitted + sign * delta.submitted),
    qcApproved: Math.max(0, row.qcApproved + sign * delta.qcApproved),
    qcRejected: Math.max(0, row.qcRejected + sign * delta.qcRejected),
    qcPending: Math.max(0, row.qcPending + sign * delta.qcPending),
    activeSurveyorIds,
    firstPendingSurveyId,
  })
}

async function applySurveyorSnapshot(ctx: MutationCtx, survey: SurveyorSurveySnapshot, sign: 1 | -1) {
  const row = await getOrCreateSurveyorStats(ctx, survey)
  const delta = surveyorCounterDeltaFor(survey)
  await ctx.db.patch(row._id, {
    total: Math.max(0, row.total + sign * delta.total),
    drafts: Math.max(0, row.drafts + sign * delta.drafts),
    submitted: Math.max(0, row.submitted + sign * delta.submitted),
    qcApproved: Math.max(0, row.qcApproved + sign * delta.qcApproved),
    qcRejected: Math.max(0, row.qcRejected + sign * delta.qcRejected),
  })
}

async function applyWardDelta(ctx: MutationCtx, before: WardSurveySnapshot, after: WardSurveySnapshot) {
  const beforeDelta = wardCounterDeltaFor(before)
  const afterDelta = wardCounterDeltaFor(after)
  const net: WardCounterDelta = { ...EMPTY_WARD_DELTA }
  addWardCounters(net, afterDelta, 1)
  addWardCounters(net, beforeDelta, -1)

  if (
    net.total === 0 &&
    net.drafts === 0 &&
    net.submitted === 0 &&
    net.qcApproved === 0 &&
    net.qcRejected === 0 &&
    net.qcPending === 0 &&
    isActiveSurveyorOnWard(before) === isActiveSurveyorOnWard(after) &&
    isPendingSubmitted(before) === isPendingSubmitted(after) &&
    before.surveyorId === after.surveyorId
  ) {
    return
  }

  const row = await getOrCreateWardStats(ctx, after.municipalityId, after.wardNo, after.city)
  let activeSurveyorIds = row.activeSurveyorIds
  activeSurveyorIds = mergeActiveSurveyorIds(
    activeSurveyorIds,
    before.surveyorId,
    isActiveSurveyorOnWard(before),
    false
  )
  activeSurveyorIds = mergeActiveSurveyorIds(activeSurveyorIds, after.surveyorId, false, isActiveSurveyorOnWard(after))

  let firstPendingSurveyId = row.firstPendingSurveyId
  firstPendingSurveyId = resolveFirstPendingId(firstPendingSurveyId, before, isPendingSubmitted(before), false)
  firstPendingSurveyId = resolveFirstPendingId(firstPendingSurveyId, after, false, isPendingSubmitted(after))

  await ctx.db.patch(row._id, {
    total: Math.max(0, row.total + net.total),
    drafts: Math.max(0, row.drafts + net.drafts),
    submitted: Math.max(0, row.submitted + net.submitted),
    qcApproved: Math.max(0, row.qcApproved + net.qcApproved),
    qcRejected: Math.max(0, row.qcRejected + net.qcRejected),
    qcPending: Math.max(0, row.qcPending + net.qcPending),
    activeSurveyorIds,
    firstPendingSurveyId,
  })
}

async function applySurveyorDelta(ctx: MutationCtx, before: SurveyorSurveySnapshot, after: SurveyorSurveySnapshot) {
  if (before.surveyorId !== after.surveyorId || before.municipalityId !== after.municipalityId) {
    await applySurveyorSnapshot(ctx, before, -1)
    await applySurveyorSnapshot(ctx, after, 1)
    return
  }

  const beforeDelta = surveyorCounterDeltaFor(before)
  const afterDelta = surveyorCounterDeltaFor(after)
  const net: SurveyorCounterDelta = { ...EMPTY_SURVEYOR_DELTA }
  addSurveyorCounters(net, afterDelta, 1)
  addSurveyorCounters(net, beforeDelta, -1)

  if (net.total === 0 && net.drafts === 0 && net.submitted === 0 && net.qcApproved === 0 && net.qcRejected === 0) {
    return
  }

  const row = await getOrCreateSurveyorStats(ctx, after)
  await ctx.db.patch(row._id, {
    total: Math.max(0, row.total + net.total),
    drafts: Math.max(0, row.drafts + net.drafts),
    submitted: Math.max(0, row.submitted + net.submitted),
    qcApproved: Math.max(0, row.qcApproved + net.qcApproved),
    qcRejected: Math.max(0, row.qcRejected + net.qcRejected),
  })
}

/** Record ward + surveyor rollups on survey insert. */
export async function recordWardSurveyorStatsInsert(ctx: MutationCtx, survey: Doc<"surveys">) {
  await applyWardSnapshot(ctx, survey, 1)
  await applySurveyorSnapshot(ctx, survey, 1)
}

/** Remove ward + surveyor rollups on survey delete. */
export async function recordWardSurveyorStatsRemove(ctx: MutationCtx, survey: Doc<"surveys">) {
  await applyWardSnapshot(ctx, survey, -1)
  await applySurveyorSnapshot(ctx, survey, -1)
}

/** Update ward + surveyor rollups when survey fields change. */
export async function recordWardSurveyorStatsUpdate(ctx: MutationCtx, before: Doc<"surveys">, after: Doc<"surveys">) {
  const wardKeyBefore = before.wardNo?.trim() ? normalizedWardKey(before.municipalityId, before.wardNo) : null
  const wardKeyAfter = after.wardNo?.trim() ? normalizedWardKey(after.municipalityId, after.wardNo) : null

  if (wardKeyBefore !== wardKeyAfter || before.municipalityId !== after.municipalityId) {
    if (wardKeyBefore) await applyWardSnapshot(ctx, before, -1)
    if (wardKeyAfter) await applyWardSnapshot(ctx, after, 1)
  } else if (wardKeyAfter) {
    await applyWardDelta(ctx, before, after)
  }

  await applySurveyorDelta(ctx, before, after)
}

export type WardStatsFilters = {
  districtId?: Id<"districts">
  municipalityId?: Id<"municipalities">
  wardNo?: string
  fromMs?: number
  toMs?: number
}

async function resolveScopedMunicipalityIdsForRollups(
  ctx: QueryCtx,
  me: Doc<"users">,
  filters: Pick<WardStatsFilters, "districtId" | "municipalityId"> = {},
  precomputed?: PrecomputedFieldContext
): Promise<Id<"municipalities">[] | null> {
  const access = precomputed?.access ?? (await fieldSurveyAccess(ctx, me))
  if (access === "none" || access === "own") return null

  const scope = precomputed?.scope ?? (await resolveTenantScope(ctx, me))
  const muniIds = tenantMunicipalityIds(scope)
  let scopedMuniIds = scope.municipalities.length > 0 ? scope.municipalities.map((m) => m._id) : [...muniIds]

  if (me.municipalityId && scopedMuniIds.length === 0) {
    scopedMuniIds = [me.municipalityId]
  }

  if (filters.municipalityId) {
    if (!scopedMuniIds.includes(filters.municipalityId)) return null
    scopedMuniIds = [filters.municipalityId]
  } else if (filters.districtId) {
    const districtMunis = scope.municipalities.filter((m) => m.districtId === filters.districtId).map((m) => m._id)
    scopedMuniIds = scopedMuniIds.filter((id) => districtMunis.includes(id))
  }

  return scopedMuniIds.length > 0 ? scopedMuniIds : null
}

function wardNumbersMatch(rowWard: string, filterWard: string): boolean {
  if (rowWard === filterWard) return true
  const a = Number(rowWard)
  const b = Number(filterWard)
  return !Number.isNaN(a) && !Number.isNaN(b) && a === b
}

/** Load ward rollup rows for command-center / analytics (no survey scan). */
export async function loadWardStatsForScope(
  ctx: QueryCtx,
  me: Doc<"users">,
  filters: WardStatsFilters = {},
  precomputed?: PrecomputedFieldContext
): Promise<WardStatsRollup[]> {
  const scopedMuniIds = await resolveScopedMunicipalityIdsForRollups(ctx, me, filters, precomputed)
  if (!scopedMuniIds) return []

  const scope = precomputed?.scope ?? (await resolveTenantScope(ctx, me))
  const muniIds = tenantMunicipalityIds(scope)
  const muniMap = new Map(scope.municipalities.map((m) => [m._id, m]))

  let targetMunis = scopedMuniIds
  if (filters.municipalityId) targetMunis = [filters.municipalityId]
  else if (!filters.wardNo) targetMunis = scopedMuniIds.slice(0, ROLLUP_ULB_CAP)

  const batchResults = await Promise.all(
    targetMunis.map(async (municipalityId) => {
      if (filters.wardNo) {
        const normalized = normalizeWardNo(filters.wardNo)
        const row = await getLegacyWardStatsRow(ctx, municipalityId, normalized)
        if (row && canReadWard(me, municipalityId, row.wardNo)) {
          return [
            {
              municipalityId: row.municipalityId,
              wardNo: row.wardNo,
              city: row.city,
              total: row.total,
              drafts: row.drafts,
              submitted: row.submitted,
              qcApproved: row.qcApproved,
              qcRejected: row.qcRejected,
              qcPending: row.qcPending,
              activeSurveyorIds: row.activeSurveyorIds,
              firstPendingSurveyId: row.firstPendingSurveyId,
            } satisfies WardStatsRollup,
          ]
        }
        return [] as WardStatsRollup[]
      }

      const wardRows = filterLegacyAnalyticsRows(
        await ctx.db
          .query("surveyWardStats")
          .withIndex("by_municipality", (q) => q.eq("municipalityId", municipalityId))
          .take(WARD_STATS_PER_MUNI_CAP)
      )

      const rows: WardStatsRollup[] = []
      for (const row of wardRows) {
        if (!muniIds.has(row.municipalityId)) continue
        if (!canReadWard(me, row.municipalityId, row.wardNo)) continue
        if (filters.districtId) {
          const muni = muniMap.get(row.municipalityId)
          if (muni?.districtId !== filters.districtId) continue
        }
        rows.push({
          municipalityId: row.municipalityId,
          wardNo: row.wardNo,
          city: row.city,
          total: row.total,
          drafts: row.drafts,
          submitted: row.submitted,
          qcApproved: row.qcApproved,
          qcRejected: row.qcRejected,
          qcPending: row.qcPending,
          activeSurveyorIds: row.activeSurveyorIds,
          firstPendingSurveyId: row.firstPendingSurveyId,
        })
      }
      return rows
    })
  )

  const rows = batchResults.flat()

  if (filters.wardNo) {
    return rows.filter((r) => wardNumbersMatch(r.wardNo, filters.wardNo!))
  }

  return rows.sort((a, b) => a.wardNo.localeCompare(b.wardNo, undefined, { numeric: true }))
}

/** Load surveyor rollup rows for analytics bySurveyor (no survey scan). */
export async function loadSurveyorStatsForScope(
  ctx: QueryCtx,
  me: Doc<"users">,
  filters: { districtId?: Id<"districts">; municipalityId?: Id<"municipalities"> } = {},
  precomputed?: PrecomputedFieldContext
): Promise<SurveyorStatsRollup[]> {
  const scopedMuniIds = await resolveScopedMunicipalityIdsForRollups(ctx, me, filters, precomputed)
  if (!scopedMuniIds) return []

  const targetMunis = filters.municipalityId ? [filters.municipalityId] : scopedMuniIds.slice(0, ROLLUP_ULB_CAP)

  const batchResults = await Promise.all(
    targetMunis.map(async (municipalityId) => {
      const muniRows = filterLegacyAnalyticsRows(
        await ctx.db
          .query("surveySurveyorStats")
          .withIndex("by_municipality", (q) => q.eq("municipalityId", municipalityId))
          .take(SURVEYOR_STATS_PER_MUNI_CAP)
      )

      const rows: SurveyorStatsRollup[] = []
      for (const row of muniRows) {
        if (filters.districtId && row.districtId !== filters.districtId) continue
        rows.push({
          surveyorId: row.surveyorId,
          municipalityId: row.municipalityId,
          districtId: row.districtId,
          total: row.total,
          drafts: row.drafts,
          submitted: row.submitted,
          qcApproved: row.qcApproved,
          qcRejected: row.qcRejected,
        })
      }
      return rows
    })
  )

  return batchResults.flat()
}

/** Aggregate in-memory buckets for backfill (single pass over survey batch). */
export type BackfillAggregates = {
  municipality: Map<Id<"municipalities">, MunicipalityAgg>
  daily: Map<string, { municipalityId: Id<"municipalities">; dateKey: string; created: number; submitted: number }>
  ward: Map<string, WardAgg>
  surveyor: Map<string, SurveyorAgg>
}

type MunicipalityAgg = {
  municipalityId: Id<"municipalities">
  total: number
  drafts: number
  submitted: number
  qcApproved: number
  qcRejected: number
  qcPending: number
  completionPctSum: number
  completionPctCount: number
}

type WardAgg = {
  municipalityId: Id<"municipalities">
  wardNo: string
  city: string
  total: number
  drafts: number
  submitted: number
  qcApproved: number
  qcRejected: number
  qcPending: number
  activeSurveyorIds: Set<Id<"users">>
  firstPendingSurveyId?: Id<"surveys">
}

type SurveyorAgg = {
  surveyorId: Id<"users">
  municipalityId: Id<"municipalities">
  districtId: Id<"districts">
  total: number
  drafts: number
  submitted: number
  qcApproved: number
  qcRejected: number
}

export function createBackfillAggregates(): BackfillAggregates {
  return {
    municipality: new Map(),
    daily: new Map(),
    ward: new Map(),
    surveyor: new Map(),
  }
}

export function mergeSurveyIntoBackfillAggregates(aggregates: BackfillAggregates, survey: Doc<"surveys">) {
  const muniId = survey.municipalityId
  let muniAgg = aggregates.municipality.get(muniId)
  if (!muniAgg) {
    muniAgg = {
      municipalityId: muniId,
      total: 0,
      drafts: 0,
      submitted: 0,
      qcApproved: 0,
      qcRejected: 0,
      qcPending: 0,
      completionPctSum: 0,
      completionPctCount: 0,
    }
    aggregates.municipality.set(muniId, muniAgg)
  }
  muniAgg.total += 1
  if (survey.status === "draft") muniAgg.drafts += 1
  if (survey.status === "submitted") muniAgg.submitted += 1
  if (survey.qcStatus === "approved") muniAgg.qcApproved += 1
  if (survey.qcStatus === "rejected") muniAgg.qcRejected += 1
  if (survey.qcStatus === "pending" && survey.status === "submitted") muniAgg.qcPending += 1
  if (survey.completionPct !== undefined) {
    muniAgg.completionPctSum += survey.completionPct
    muniAgg.completionPctCount += 1
  }

  const createdKey = `${muniId}:${formatDateKeyForBackfill(survey._creationTime)}`
  let createdDaily = aggregates.daily.get(createdKey)
  if (!createdDaily) {
    createdDaily = {
      municipalityId: muniId,
      dateKey: formatDateKeyForBackfill(survey._creationTime),
      created: 0,
      submitted: 0,
    }
    aggregates.daily.set(createdKey, createdDaily)
  }
  createdDaily.created += 1

  if (survey.status === "submitted" || survey.status === "approved") {
    const submittedTs = survey.submittedAt ?? survey._creationTime
    const submittedKey = `${muniId}:${formatDateKeyForBackfill(submittedTs)}`
    let submittedDaily = aggregates.daily.get(submittedKey)
    if (!submittedDaily) {
      submittedDaily = {
        municipalityId: muniId,
        dateKey: formatDateKeyForBackfill(submittedTs),
        created: 0,
        submitted: 0,
      }
      aggregates.daily.set(submittedKey, submittedDaily)
    }
    submittedDaily.submitted += 1
  }

  if (survey.wardNo?.trim()) {
    const wardKey = normalizedWardKey(muniId, survey.wardNo)
    let wardAgg = aggregates.ward.get(wardKey)
    if (!wardAgg) {
      wardAgg = {
        municipalityId: muniId,
        wardNo: normalizeWardNo(survey.wardNo),
        city: survey.city,
        total: 0,
        drafts: 0,
        submitted: 0,
        qcApproved: 0,
        qcRejected: 0,
        qcPending: 0,
        activeSurveyorIds: new Set(),
      }
      aggregates.ward.set(wardKey, wardAgg)
    }
    wardAgg.total += 1
    if (survey.status === "draft") wardAgg.drafts += 1
    if (survey.status === "submitted") wardAgg.submitted += 1
    if (survey.qcStatus === "approved") wardAgg.qcApproved += 1
    if (survey.qcStatus === "rejected") wardAgg.qcRejected += 1
    if (survey.qcStatus === "pending" && survey.status === "submitted") {
      wardAgg.qcPending += 1
      if (!wardAgg.firstPendingSurveyId || wardAgg.firstPendingSurveyId > survey._id) {
        wardAgg.firstPendingSurveyId = survey._id
      }
    }
    if (survey.status === "draft" || survey.status === "submitted") {
      wardAgg.activeSurveyorIds.add(survey.surveyorId)
    }
  }

  const surveyorKey = `${survey.surveyorId}:${muniId}`
  let surveyorAgg = aggregates.surveyor.get(surveyorKey)
  if (!surveyorAgg) {
    surveyorAgg = {
      surveyorId: survey.surveyorId,
      municipalityId: muniId,
      districtId: survey.districtId,
      total: 0,
      drafts: 0,
      submitted: 0,
      qcApproved: 0,
      qcRejected: 0,
    }
    aggregates.surveyor.set(surveyorKey, surveyorAgg)
  }
  surveyorAgg.total += 1
  if (survey.status === "draft") surveyorAgg.drafts += 1
  if (survey.status === "submitted") surveyorAgg.submitted += 1
  if (survey.qcStatus === "approved") surveyorAgg.qcApproved += 1
  if (survey.qcStatus === "rejected") surveyorAgg.qcRejected += 1
}

function formatDateKeyForBackfill(ms: number): string {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Write merged backfill aggregates to rollup tables (idempotent full replace per key). */
export async function flushBackfillAggregates(ctx: MutationCtx, aggregates: BackfillAggregates, replace: boolean) {
  for (const agg of aggregates.municipality.values()) {
    const existing = await getLegacyMunicipalityStatsRow(ctx, agg.municipalityId)

    const patch = {
      total: replace ? agg.total : (existing?.total ?? 0) + agg.total,
      drafts: replace ? agg.drafts : (existing?.drafts ?? 0) + agg.drafts,
      submitted: replace ? agg.submitted : (existing?.submitted ?? 0) + agg.submitted,
      qcApproved: replace ? agg.qcApproved : (existing?.qcApproved ?? 0) + agg.qcApproved,
      qcRejected: replace ? agg.qcRejected : (existing?.qcRejected ?? 0) + agg.qcRejected,
      qcPending: replace ? agg.qcPending : (existing?.qcPending ?? 0) + agg.qcPending,
      completionPctSum: replace ? agg.completionPctSum : (existing?.completionPctSum ?? 0) + agg.completionPctSum,
      completionPctCount: replace
        ? agg.completionPctCount
        : (existing?.completionPctCount ?? 0) + agg.completionPctCount,
    }

    if (existing) {
      await ctx.db.patch(existing._id, patch)
    } else {
      await ctx.db.insert("surveyMunicipalityStats", {
        municipalityId: agg.municipalityId,
        ...patch,
      })
    }
  }

  for (const agg of aggregates.daily.values()) {
    const existing = await getLegacyDailyStatsRow(ctx, agg.municipalityId, agg.dateKey)

    const patch = {
      created: replace ? agg.created : (existing?.created ?? 0) + agg.created,
      submitted: replace ? agg.submitted : (existing?.submitted ?? 0) + agg.submitted,
    }

    if (existing) {
      await ctx.db.patch(existing._id, patch)
    } else {
      await ctx.db.insert("surveyDailyStats", {
        municipalityId: agg.municipalityId,
        dateKey: agg.dateKey,
        ...patch,
      })
    }
  }

  for (const agg of aggregates.ward.values()) {
    const existing = await getLegacyWardStatsRow(ctx, agg.municipalityId, agg.wardNo)

    const activeSurveyorIds = [...agg.activeSurveyorIds]
    const patch = {
      city: agg.city,
      total: replace ? agg.total : (existing?.total ?? 0) + agg.total,
      drafts: replace ? agg.drafts : (existing?.drafts ?? 0) + agg.drafts,
      submitted: replace ? agg.submitted : (existing?.submitted ?? 0) + agg.submitted,
      qcApproved: replace ? agg.qcApproved : (existing?.qcApproved ?? 0) + agg.qcApproved,
      qcRejected: replace ? agg.qcRejected : (existing?.qcRejected ?? 0) + agg.qcRejected,
      qcPending: replace ? agg.qcPending : (existing?.qcPending ?? 0) + agg.qcPending,
      activeSurveyorIds: replace
        ? activeSurveyorIds
        : [...new Set([...(existing?.activeSurveyorIds ?? []), ...activeSurveyorIds])],
      firstPendingSurveyId: replace
        ? agg.firstPendingSurveyId
        : (existing?.firstPendingSurveyId ?? agg.firstPendingSurveyId),
    }

    if (existing) {
      await ctx.db.patch(existing._id, patch)
    } else {
      await ctx.db.insert("surveyWardStats", {
        municipalityId: agg.municipalityId,
        wardNo: agg.wardNo,
        ...patch,
      })
    }
  }

  for (const agg of aggregates.surveyor.values()) {
    const existing = await getLegacySurveyorStatsRow(ctx, agg.surveyorId, agg.municipalityId)

    const patch = {
      districtId: agg.districtId,
      total: replace ? agg.total : (existing?.total ?? 0) + agg.total,
      drafts: replace ? agg.drafts : (existing?.drafts ?? 0) + agg.drafts,
      submitted: replace ? agg.submitted : (existing?.submitted ?? 0) + agg.submitted,
      qcApproved: replace ? agg.qcApproved : (existing?.qcApproved ?? 0) + agg.qcApproved,
      qcRejected: replace ? agg.qcRejected : (existing?.qcRejected ?? 0) + agg.qcRejected,
    }

    if (existing) {
      await ctx.db.patch(existing._id, patch)
    } else {
      await ctx.db.insert("surveySurveyorStats", {
        surveyorId: agg.surveyorId,
        municipalityId: agg.municipalityId,
        ...patch,
      })
    }
  }
}

/** Clear all rollup tables before a full re-backfill (one table page at a time). */
const ROLLUP_CLEAR_PAGE = 100

type RollupClearTable =
  | "surveyMunicipalityStats"
  | "surveyDailyStats"
  | "surveyWardStats"
  | "surveySurveyorStats"

const ROLLUP_CLEAR_ORDER: RollupClearTable[] = [
  "surveyMunicipalityStats",
  "surveyDailyStats",
  "surveyWardStats",
  "surveySurveyorStats",
]

/**
 * Delete one page of a rollup table. Returns whether more pages remain for this table.
 * Callers must chain until all tables are empty — never `.collect()` entire rollups.
 */
export async function clearRollupStatsPage(
  ctx: MutationCtx,
  table: RollupClearTable,
): Promise<{ deleted: number; done: boolean }> {
  const page = await ctx.db.query(table).paginate({ cursor: null, numItems: ROLLUP_CLEAR_PAGE })
  for (const row of page.page) {
    await ctx.db.delete(row._id)
  }
  // After deletes, re-check whether any docs remain (cursor from pre-delete page is unsafe).
  const remaining = await ctx.db.query(table).take(1)
  return { deleted: page.page.length, done: remaining.length === 0 }
}

export function nextRollupClearTable(current: RollupClearTable | null): RollupClearTable | null {
  if (current === null) return ROLLUP_CLEAR_ORDER[0] ?? null
  const idx = ROLLUP_CLEAR_ORDER.indexOf(current)
  if (idx < 0 || idx >= ROLLUP_CLEAR_ORDER.length - 1) return null
  return ROLLUP_CLEAR_ORDER[idx + 1] ?? null
}

/** @deprecated Prefer clearRollupStatsPage via scheduler — unbounded collect fails at scale. */
export async function clearAllRollupStats(ctx: MutationCtx) {
  for (const table of ROLLUP_CLEAR_ORDER) {
    for (;;) {
      const { done } = await clearRollupStatsPage(ctx, table)
      if (done) break
    }
  }
}
