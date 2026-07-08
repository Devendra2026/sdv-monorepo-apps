"use client"

import type { DateFilterState } from "@/components/surveys/survey-filters"
import type { SurveyRow } from "@/components/surveys/survey-tables"
import { useMasters, useWardsForMunicipality } from "@/hooks/masters/useMasters"
import { useQcWorkScope } from "@/hooks/qc/useQcWorkScope"
import { searchQcRegistry, useSurveyList, useSurveyListPaginated } from "@/hooks/surveys/useSurveys"
import { useClientNowMs } from "@/hooks/use-client-now"
import { useConvexAuthReady } from "@/hooks/use-convex-auth-ready"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { activeParcelSiblingPool, buildParcelSiblingIndex, filterParcelSharedRows } from "@/lib/qc/parcel-siblings"
import { qcPerfMark, qcPerfMeasure, qcPerfNowLabel } from "@/lib/qc/qc-perf"
import { computeQcWardStats, enrichServerWardStats, type QcWardRow } from "@/lib/qc/ward-stats"
import { sanitizeQcWorkScope, type QcWorkScope } from "@/lib/qc/work-scope"
import { buildUlbCodeMap } from "@/lib/survey/resolve-display-property-id"
import { qcTabToListFilters } from "@/lib/surveys/survey-list-filters"
import { api } from "@workspace/backend/convex/_generated/api.js"
import type { Id } from "@workspace/backend/convex/_generated/dataModel.js"
import { useQuery as useConvexQuery } from "convex/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

/** Cap for ward roll-up fallback only (primary stats come from server). */
const QC_AGGREGATE_LIMIT = 500

export type QcQueueStats = {
  pending: number
  approved: number
  rejected: number
  drafts: number
  submittedToday: number
  submitted: number
  qcCompletionPct: number
}

const EMPTY_STATS: QcQueueStats = {
  pending: 0,
  approved: 0,
  rejected: 0,
  drafts: 0,
  submittedToday: 0,
  submitted: 0,
  qcCompletionPct: 0,
}

export type UseQcQueueOptions = {
  initialTab?: string
  /** Command center only needs aggregates; registry uses cursor pagination for the table. */
  mode?: "command" | "registry"
}

export function useQcQueue(options: UseQcQueueOptions = {}) {
  const mode = options.mode ?? "registry"
  const { scope, setScope, patchScope, scopeReady } = useQcWorkScope()
  const { masters } = useMasters()
  const authReady = useConvexAuthReady()
  const nowMs = useClientNowMs()
  const tabSwitchStartMarkRef = useRef<string | null>(null)

  const queryScope = useMemo(() => {
    if (masters) {
      return sanitizeQcWorkScope(scope, {
        municipalityIds: new Set(masters.ulbs.map((u) => u._id)),
        districtIds: new Set(masters.districts.map((d) => d._id)),
      })
    }
    return scope
  }, [scope, masters])

  const ulbCodes = useMemo(() => (masters ? buildUlbCodeMap(masters.ulbs) : undefined), [masters])

  const [dateFilters, setDateFilters] = useState<DateFilterState>({})
  const [registrySearch, setRegistrySearch] = useState("")
  const [pageSize, setPageSize] = useState(20)
  const [activeTab, setActiveTab] = useState(options.initialTab ?? "active")

  const wardsForMuni = useWardsForMunicipality(scopeReady ? queryScope.municipalityId : undefined)
  const wardLabels = useMemo(() => {
    const map = new Map<string, string>()
    for (const w of wardsForMuni ?? []) {
      if (w.wardNo && w.name) map.set(w.wardNo, w.name)
    }
    return map
  }, [wardsForMuni])

  const handleScopeChange = useCallback(
    (next: QcWorkScope) => {
      setScope(next)
    },
    [setScope]
  )

  const handleDateFiltersChange = useCallback((next: DateFilterState) => {
    setDateFilters(next)
  }, [])

  const handleRegistrySearchChange = useCallback((term: string) => {
    setRegistrySearch(term)
  }, [])

  const handleTabChange = useCallback(
    (tab: string) => {
      if (mode === "registry") {
        const startMark = qcPerfNowLabel(`qc.registry.tab_switch.start.${tab}`)
        qcPerfMark(startMark)
        tabSwitchStartMarkRef.current = startMark
      }
      setActiveTab(tab)
    },
    [mode]
  )

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size)
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

  const tabFilters = useMemo(() => qcTabToListFilters(activeTab), [activeTab])

  const debouncedRegistrySearch = useDebouncedValue(registrySearch, 300)
  const registrySearchTerm = debouncedRegistrySearch.trim() || undefined

  const serverStats = useConvexQuery(
    api.qc.queries.commandCenterStats,
    authReady && scopeReady
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

  const needsAggregateSurveys = mode === "command" || (mode === "registry" && activeTab === "parcelShared")
  const aggregateSurveys = useSurveyList(
    scopeReady && needsAggregateSurveys ? { ...scopeFilters, limit: QC_AGGREGATE_LIMIT } : {},
    scopeReady && needsAggregateSurveys
  )

  const paginated = useSurveyListPaginated(
    {
      ...scopeFilters,
      ...tabFilters,
      fromMs: fromDateMs,
      toMs: toDateMs,
      searchTerm: registrySearchTerm,
      parcelSharedOnly: activeTab === "parcelShared",
    },
    pageSize,
    scopeReady && mode === "registry"
  )

  const isLoading =
    mode === "registry"
      ? paginated.isLoading
      : scopeReady
        ? serverStats === undefined || aggregateSurveys === undefined
        : aggregateSurveys === undefined

  useEffect(() => {
    if (mode !== "registry") return
    const startMark = tabSwitchStartMarkRef.current
    if (!startMark) return
    if (isLoading) return

    const endMark = qcPerfNowLabel(`qc.registry.tab_switch.end.${activeTab}`)
    qcPerfMark(endMark)
    qcPerfMeasure("qc.registry.tab_switch", startMark, endMark)
    tabSwitchStartMarkRef.current = null
  }, [activeTab, isLoading, mode])

  const registryFiltered = useMemo(() => {
    const rows = mode === "registry" ? paginated.surveys : aggregateSurveys
    if (!rows) return rows
    let filtered =
      mode === "registry"
        ? ([...rows] as SurveyRow[])
        : (searchQcRegistry(rows as SurveyRow[], debouncedRegistrySearch, ulbCodes) as SurveyRow[])
    if (mode === "registry" && activeTab === "all") {
      filtered = filtered.filter((r) => r.status !== "draft" || r.qcStatus !== "pending")
    }
    return filtered
  }, [mode, paginated.surveys, aggregateSurveys, debouncedRegistrySearch, activeTab, ulbCodes])

  const filteredByDate = useMemo(() => {
    const base = aggregateSurveys ?? []
    return base.filter((r) => {
      const ts = r.submittedAt ?? r._creationTime
      if (fromDateMs !== undefined && ts < fromDateMs) return false
      if (toDateMs !== undefined && ts > toDateMs) return false
      return true
    }) as SurveyRow[]
  }, [aggregateSurveys, fromDateMs, toDateMs])

  const filteredByTab = useMemo(() => {
    if (mode === "registry") {
      return (registryFiltered ?? []) as SurveyRow[]
    }
    const rows = filteredByDate
    if (activeTab === "pending") return rows.filter((r) => r.qcStatus === "pending" && r.status === "submitted")
    if (activeTab === "approved") return rows.filter((r) => r.qcStatus === "approved")
    if (activeTab === "rejected") return rows.filter((r) => r.qcStatus === "rejected")
    if (activeTab === "active") {
      return rows.filter((r) => r.qcStatus === "approved" || (r.qcStatus === "pending" && r.status === "submitted"))
    }
    if (activeTab === "parcelShared") {
      const activePool = rows.filter(
        (r) => r.qcStatus === "approved" || (r.qcStatus === "pending" && r.status === "submitted")
      )
      return filterParcelSharedRows(activePool)
    }
    return rows.filter((r) => r.status !== "draft" || r.qcStatus !== "pending")
  }, [mode, registryFiltered, filteredByDate, activeTab])

  const pagedRows = useMemo(() => {
    if (mode === "registry") return filteredByTab
    const pageStart = 0
    return filteredByTab.slice(pageStart, pageStart + pageSize) as SurveyRow[]
  }, [mode, filteredByTab, pageSize])

  const pageStart = mode === "registry" ? (paginated.pageNumber - 1) * pageSize : 0
  const canGoPrev = mode === "registry" ? paginated.canGoPrev : false
  const canGoNext = mode === "registry" ? paginated.canGoNext : false

  const stats = useMemo((): QcQueueStats => {
    if (!serverStats) return EMPTY_STATS
    return {
      pending: serverStats.pending,
      approved: serverStats.approved,
      rejected: serverStats.rejected,
      drafts: serverStats.drafts,
      submittedToday: serverStats.submittedToday,
      submitted: serverStats.submitted,
      qcCompletionPct: serverStats.qcCompletionPct,
    }
  }, [serverStats])

  const wardStats = useMemo((): QcWardRow[] => {
    if (serverStats?.wardStats) {
      return enrichServerWardStats(serverStats.wardStats, wardLabels)
    }
    return computeQcWardStats(filteredByDate, wardLabels)
  }, [serverStats, filteredByDate, wardLabels])

  const rejectedCount = stats.rejected

  const parcelSharedCount = useMemo(() => {
    const base = (aggregateSurveys ?? filteredByDate) as SurveyRow[]
    const activePool = activeParcelSiblingPool(base)
    return filterParcelSharedRows(activePool).length
  }, [aggregateSurveys, filteredByDate])

  const parcelSiblingIndex = useMemo(() => {
    const base = (aggregateSurveys ?? []) as SurveyRow[]
    return buildParcelSiblingIndex(activeParcelSiblingPool(base))
  }, [aggregateSurveys])

  const filteredCount = mode === "registry" ? (paginated.totalCount ?? filteredByTab.length) : filteredByTab.length

  return {
    scope,
    dateFilters,
    registrySearch,
    activeTab,
    pageNumber: mode === "registry" ? paginated.pageNumber : 1,
    pageSize,
    pageStart,
    isLoading,
    stats,
    wardStats,
    rejectedCount,
    parcelSharedCount,
    parcelSiblingIndex,
    filteredByTab,
    filteredCount,
    pagedRows,
    canGoPrev,
    canGoNext,
    handleScopeChange,
    handleDateFiltersChange,
    handleRegistrySearchChange,
    patchScope,
    handleTabChange,
    handlePageSizeChange,
    goNext: paginated.goNext,
    goPrev: paginated.goPrev,
  }
}
