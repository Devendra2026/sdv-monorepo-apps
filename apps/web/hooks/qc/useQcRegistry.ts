"use client"

import type { SurveyRow } from "@/components/surveys/survey-tables"
import { useMasters } from "@/hooks/masters/useMasters"
import { useQcQuery } from "@/hooks/qc/convex/useQcQuery"
import { useQcWorkScope } from "@/hooks/qc/useQcWorkScope"
import { useSurveyList, useSurveyListPaginated } from "@/hooks/surveys/useSurveys"
import { useHasCapability } from "@/hooks/use-capability"
import { useClientNowMs } from "@/hooks/use-client-now"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { activeParcelSiblingPool, buildParcelSiblingIndex, filterParcelSharedRows } from "@/lib/qc/parcel-siblings"
import { sanitizeQcWorkScope, type QcWorkScope } from "@/lib/qc/work-scope"
import { qcTabToListFilters } from "@/lib/surveys/survey-list-filters"
import { api } from "@workspace/backend/convex/_generated/api.js"
import type { Id } from "@workspace/backend/convex/_generated/dataModel.js"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import type { ParcelSiblingIndex } from "@/lib/qc/parcel-siblings"
import { qcPerfMark, qcPerfMeasure, qcPerfNowLabel } from "@/lib/qc/qc-perf"
import type { FunctionReturnType } from "convex/server"
import type { QcQueueStats } from "./useQcQueue"

/** Cap for parcel sibling / conflict rollups (registry badge & index). */
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

export type UseQcRegistryOptions = {
  initialTab?: string
  /** Hydrated command-center stats from a server preload (default filters only). */
  seedStats?: FunctionReturnType<typeof api.qc.queries.commandCenterStats>
}

export function useQcRegistry(options: UseQcRegistryOptions = {}) {
  const { scope, patchScope, scopeReady, setScope } = useQcWorkScope()
  const { masters } = useMasters()
  const nowMs = useClientNowMs()
  const canReview = useHasCapability("qc.review")

  const queryScope = useMemo(() => {
    if (masters) {
      return sanitizeQcWorkScope(scope, {
        municipalityIds: new Set(masters.ulbs.map((u) => u._id)),
        districtIds: new Set(masters.districts.map((d) => d._id)),
      })
    }
    return scope
  }, [scope, masters])

  const [registrySearch, setRegistrySearch] = useState("")
  const [pageSize, setPageSize] = useState(20)
  const [activeTab, setActiveTab] = useState(options.initialTab ?? "active")
  const tabSwitchStartMarkRef = useRef<string | null>(null)

  const handleTabChange = useCallback(
    (tab: string) => {
      const startMark = qcPerfNowLabel(`qc.registry.tab_switch.start.${tab}`)
      qcPerfMark(startMark)
      tabSwitchStartMarkRef.current = startMark
      setActiveTab(tab)
    },
    [setActiveTab]
  )

  const handleScopeChange = useCallback(
    (next: QcWorkScope) => {
      setScope(next)
    },
    [setScope]
  )

  const handleRegistrySearchChange = useCallback((term: string) => {
    setRegistrySearch(term)
  }, [])

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

  const tabFilters = useMemo(() => qcTabToListFilters(activeTab), [activeTab])

  const debouncedRegistrySearch = useDebouncedValue(registrySearch, 300)
  const registrySearchTerm = debouncedRegistrySearch.trim() || undefined

  const serverStats = useQcQuery(
    api.qc.queries.commandCenterStats,
    scopeReady
      ? {
          wardNo: scopeFilters.wardNo,
          districtId: scopeFilters.districtId as Id<"districts"> | undefined,
          municipalityId: scopeFilters.municipalityId as Id<"municipalities"> | undefined,
          nowMs,
        }
      : "skip"
  )

  const resolvedStats = serverStats ?? options.seedStats

  const needsAggregateSurveys = activeTab === "parcelShared"
  const aggregateSurveys = useSurveyList(
    scopeReady && canReview && needsAggregateSurveys ? { ...scopeFilters, limit: QC_AGGREGATE_LIMIT } : {},
    scopeReady && canReview && needsAggregateSurveys
  )

  const paginated = useSurveyListPaginated(
    {
      ...scopeFilters,
      ...tabFilters,
      parcelSharedOnly: activeTab === "parcelShared",
      searchTerm: registrySearchTerm,
    },
    pageSize,
    scopeReady && canReview
  )

  const isLoading = paginated.isLoading
  const authFailed = paginated.authFailed === true

  const stuckToastShown = useRef(false)
  useEffect(() => {
    if (!scopeReady || !canReview || !isLoading || authFailed) {
      stuckToastShown.current = false
      return
    }
    const timer = window.setTimeout(() => {
      if (stuckToastShown.current) return
      stuckToastShown.current = true
      toast.error(
        "Still loading QC registry. Check your connection to the API, or disable Brave Shields for this site."
      )
    }, 15_000)
    return () => window.clearTimeout(timer)
  }, [scopeReady, canReview, isLoading, authFailed])

  useEffect(() => {
    const startMark = tabSwitchStartMarkRef.current
    if (!startMark) return
    if (isLoading) return
    const endMark = qcPerfNowLabel(`qc.registry.tab_switch.end.${activeTab}`)
    qcPerfMark(endMark)
    qcPerfMeasure("qc.registry.tab_switch", startMark, endMark)
    tabSwitchStartMarkRef.current = null
  }, [activeTab, isLoading])

  const registryFiltered = useMemo(() => {
    const rows = paginated.surveys
    if (!rows) return rows
    let filtered = [...(rows as SurveyRow[])]
    if (activeTab === "all") {
      filtered = filtered.filter((r) => r.status !== "draft" || r.qcStatus !== "pending")
    }
    return filtered
  }, [paginated.surveys, activeTab])

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

  const rejectedCount = stats.rejected

  const parcelSharedCount = useMemo(() => {
    const base = (aggregateSurveys ?? []) as SurveyRow[]
    const activePool = activeParcelSiblingPool(base)
    return filterParcelSharedRows(activePool).length
  }, [aggregateSurveys])

  const parcelSiblingIndex: ParcelSiblingIndex = useMemo(() => {
    const base = (aggregateSurveys ?? []) as SurveyRow[]
    return buildParcelSiblingIndex(activeParcelSiblingPool(base))
  }, [aggregateSurveys])

  const filteredCount = paginated.totalCount ?? registryFiltered?.length ?? 0
  const pagedRows = registryFiltered
  const pageStart = (paginated.pageNumber - 1) * pageSize

  // Preserve the original QC queue shape used by existing pages.
  return {
    scope,
    activeTab,
    pageNumber: paginated.pageNumber,
    pageSize,
    pageStart,
    isLoading,
    authFailed,
    stats,
    rejectedCount,
    parcelSharedCount,
    parcelSiblingIndex,
    filteredCount,
    pagedRows,
    registrySearch,
    canGoPrev: paginated.canGoPrev,
    canGoNext: paginated.canGoNext,
    patchScope,
    handleRegistrySearchChange,
    handleTabChange,
    handlePageSizeChange,
    goNext: paginated.goNext,
    goPrev: paginated.goPrev,
    // unused by the registry page, but kept for compatibility with the old hook shape
    handleScopeChange,
  }
}
