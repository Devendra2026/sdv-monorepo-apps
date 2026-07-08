"use client"

import type { DateFilterState } from "@/components/surveys/survey-filters"
import { useMasters, useWardsForMunicipality } from "@/hooks/masters/useMasters"
import { useQcQuery } from "@/hooks/qc/convex/useQcQuery"
import { useQcWorkScope } from "@/hooks/qc/useQcWorkScope"
import { useSurveyList } from "@/hooks/surveys/useSurveys"
import { useHasCapability } from "@/hooks/use-capability"
import { useClientNowMs } from "@/hooks/use-client-now"
import { computeQcWardStats, enrichServerWardStats, type QcWardRow } from "@/lib/qc/ward-stats"
import { sanitizeQcWorkScope, type QcWorkScope } from "@/lib/qc/work-scope"
import { api } from "@workspace/backend/convex/_generated/api.js"
import type { Id } from "@workspace/backend/convex/_generated/dataModel.js"
import type { FunctionReturnType } from "convex/server"
import { useCallback, useMemo, useState } from "react"

import type { QcQueueStats } from "./useQcQueue"

/** Cap for command-center ward roll-up fallback only (primary stats come from server). */
const QC_AGGREGATE_LIMIT = 500

const EMPTY_STATS: QcQueueStats = {
  pending: 0,
  approved: 0,
  rejected: 0,
  drafts: 0,
  submittedToday: 0,
  submitted: 0,
  qcCompletionPct: 0,
}

type CommandCenterStats = FunctionReturnType<typeof api.qc.queries.commandCenterStats>

export function useQcCommandCenter(options: { seedStats?: CommandCenterStats } = {}) {
  const { scope, setScope, scopeReady } = useQcWorkScope()
  const { masters } = useMasters()
  const nowMs = useClientNowMs()
  const canReview = useHasCapability("qc.review")

  const queryScope = useMemo(() => {
    if (!masters) return scope
    return sanitizeQcWorkScope(scope, {
      municipalityIds: new Set(masters.ulbs.map((u) => u._id)),
      districtIds: new Set(masters.districts.map((d) => d._id)),
    })
  }, [scope, masters])

  const wardsForMuni = useWardsForMunicipality(scopeReady ? queryScope.municipalityId : undefined)
  const wardLabelsFromWards = useMemo(() => {
    const map = new Map<string, string>()
    for (const w of wardsForMuni ?? []) {
      if (w.wardNo && w.name) map.set(w.wardNo, w.name)
    }
    return map
  }, [wardsForMuni])

  const [dateFilters, setDateFilters] = useState<DateFilterState>({})

  const handleScopeChange = useCallback(
    (next: QcWorkScope) => {
      setScope(next)
    },
    [setScope]
  )

  const handleDateFiltersChange = useCallback((next: DateFilterState) => {
    setDateFilters(next)
  }, [])

  const scopeFilters = useMemo(
    () => ({
      wardNo: queryScope.wardNo,
      districtId: queryScope.districtId,
      municipalityId: queryScope.municipalityId,
    }),
    [queryScope.wardNo, queryScope.districtId, queryScope.municipalityId]
  )

  const fromDateMs = useMemo(
    () => (dateFilters.fromDate ? new Date(`${dateFilters.fromDate}T00:00:00`).getTime() : undefined),
    [dateFilters.fromDate]
  )

  const toDateMs = useMemo(
    () => (dateFilters.toDate ? new Date(`${dateFilters.toDate}T23:59:59.999`).getTime() : undefined),
    [dateFilters.toDate]
  )

  const serverStats = useQcQuery(
    api.qc.queries.commandCenterStats,
    scopeReady
      ? {
          wardNo: scopeFilters.wardNo,
          districtId: scopeFilters.districtId as Id<"districts"> | undefined,
          municipalityId: scopeFilters.municipalityId as Id<"municipalities"> | undefined,
          fromMs: fromDateMs,
          toMs: toDateMs,
          nowMs,
        }
      : "skip"
  )

  const resolvedStats = serverStats ?? options.seedStats
  const shouldLoadAggregateSurveys = scopeReady && canReview && resolvedStats === undefined

  const aggregateSurveys = useSurveyList(
    shouldLoadAggregateSurveys
      ? {
          ...scopeFilters,
          limit: QC_AGGREGATE_LIMIT,
        }
      : {},
    shouldLoadAggregateSurveys
  )

  const isLoading = scopeReady ? resolvedStats === undefined : true

  const filteredByDate = useMemo(() => {
    const base = aggregateSurveys ?? []
    return base.filter((r) => {
      const ts = r.submittedAt ?? r._creationTime
      if (fromDateMs !== undefined && ts < fromDateMs) return false
      if (toDateMs !== undefined && ts > toDateMs) return false
      return true
    })
  }, [aggregateSurveys, fromDateMs, toDateMs])

  const stats = useMemo((): QcQueueStats => {
    if (!resolvedStats) return EMPTY_STATS
    return {
      pending: resolvedStats.pending,
      approved: resolvedStats.approved,
      rejected: resolvedStats.rejected,
      drafts: resolvedStats.drafts,
      submittedToday: resolvedStats.submittedToday,
      submitted: resolvedStats.submitted,
      qcCompletionPct: resolvedStats.qcCompletionPct,
    }
  }, [resolvedStats])

  const wardStats = useMemo((): QcWardRow[] => {
    if (resolvedStats?.wardStats) {
      return enrichServerWardStats(resolvedStats.wardStats, wardLabelsFromWards)
    }
    return computeQcWardStats(filteredByDate, wardLabelsFromWards)
  }, [resolvedStats, filteredByDate, wardLabelsFromWards])

  const rejectedCount = stats.rejected

  return {
    scope,
    dateFilters,
    handleScopeChange,
    handleDateFiltersChange,
    isLoading,
    stats,
    wardStats,
    rejectedCount,
  }
}
