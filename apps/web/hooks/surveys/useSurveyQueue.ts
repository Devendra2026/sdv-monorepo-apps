"use client"

import type { SurveyDataTableRow } from "@/components/surveys/survey-data-table"
import type { DateFilterState } from "@/components/surveys/survey-filters"
import { useMasters, useWardsForMunicipality } from "@/hooks/masters/useMasters"
import { useSurveyWorkScope } from "@/hooks/surveys/useSurveyWorkScope"
import { useSurveyListPaginated } from "@/hooks/surveys/useSurveys"
import { useHasCapability } from "@/hooks/use-capability"
import { useClientNowMs } from "@/hooks/use-client-now"
import { useConvexAuthReady } from "@/hooks/use-convex-auth-ready"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import type { QcStatus, SurveyStatus } from "@/lib/domain"
import { sanitizeSurveyWorkScope, type SurveyWorkScope } from "@/lib/survey/work-scope"
import { surveyTabToListFilters } from "@/lib/surveys/survey-list-filters"
import { enrichServerSurveyWardStats, type SurveyWardRow } from "@/lib/surveys/ward-stats"
import { api } from "@workspace/backend/convex/_generated/api.js"
import type { Id } from "@workspace/backend/convex/_generated/dataModel.js"
import { useQuery as useConvexQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { useCallback, useMemo, useState } from "react"

type CommandCenterStats = FunctionReturnType<typeof api.surveys.queries.commandCenterStats>
type RegistryPage = FunctionReturnType<typeof api.surveys.queries.listPaginated>

export type SurveyQueueStats = {
  total: number
  drafts: number
  submitted: number
  submittedToday: number
  qcApproved: number
  qcPending: number
  qcRejected: number
  surveyCompletionPct: number
}

const EMPTY_STATS: SurveyQueueStats = {
  total: 0,
  drafts: 0,
  submitted: 0,
  submittedToday: 0,
  qcApproved: 0,
  qcPending: 0,
  qcRejected: 0,
  surveyCompletionPct: 0,
}

export type UseSurveyQueueOptions = {
  initialTab?: string
  mode?: "command" | "registry"
  /** Hydrated command-center stats from a server preload (default filters only). */
  seedStats?: CommandCenterStats
  /** Hydrated registry page from a server preload (default filters only). */
  seedRegistryPage?: RegistryPage
  /** Server-rendered clock seed for deterministic query args. */
  seedNowMs?: number
}

export function useSurveyQueue(options: UseSurveyQueueOptions = {}) {
  const mode = options.mode ?? "registry"
  const canViewAll = useHasCapability("surveys.viewAll")
  const { scope, setScope, patchScope, scopeReady } = useSurveyWorkScope()
  const { masters } = useMasters()
  const authReady = useConvexAuthReady()
  const nowMs = useClientNowMs(options.seedNowMs)

  const queryScope = useMemo(() => {
    if (masters) {
      return sanitizeSurveyWorkScope(scope, {
        municipalityIds: new Set(masters.ulbs.map((u) => u._id)),
        districtIds: new Set(masters.districts.map((d) => d._id)),
      })
    }
    return scope
  }, [scope, masters])

  const [dateFilters, setDateFilters] = useState<DateFilterState>({})
  const [surveyorSearch, setSurveyorSearch] = useState("")
  const [pageSize, setPageSize] = useState(20)
  const [activeTab, setActiveTab] = useState(options.initialTab ?? "all")

  const wardsForMuni = useWardsForMunicipality(scopeReady ? queryScope.municipalityId : undefined)
  const wardLabels = useMemo(() => {
    const map = new Map<string, string>()
    for (const w of wardsForMuni ?? []) {
      if (w.wardNo && w.name) map.set(w.wardNo, w.name)
    }
    return map
  }, [wardsForMuni])

  const handleScopeChange = useCallback(
    (next: SurveyWorkScope) => {
      setScope(next)
    },
    [setScope]
  )

  const handleDateFiltersChange = useCallback((next: DateFilterState) => {
    setDateFilters(next)
  }, [])

  const handleSurveyorSearchChange = useCallback((term: string) => {
    setSurveyorSearch(term)
  }, [])

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab)
  }, [])

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size)
  }, [])

  const scopeFilters = useMemo(
    () => ({
      wardNo: queryScope.wardNo,
      districtId: queryScope.districtId,
      municipalityId: queryScope.municipalityId,
      status: queryScope.status as SurveyStatus | undefined,
      qcStatus: queryScope.qcStatus as QcStatus | undefined,
    }),
    [queryScope]
  )

  const fromDateMs = useMemo(
    () => (dateFilters.fromDate ? new Date(`${dateFilters.fromDate}T00:00:00`).getTime() : undefined),
    [dateFilters.fromDate]
  )
  const toDateMs = useMemo(
    () => (dateFilters.toDate ? new Date(`${dateFilters.toDate}T23:59:59.999`).getTime() : undefined),
    [dateFilters.toDate]
  )

  const tabFilters = useMemo(() => surveyTabToListFilters(activeTab), [activeTab])
  const debouncedSurveyorSearch = useDebouncedValue(surveyorSearch, 300)
  const surveyorSearchTerm = debouncedSurveyorSearch.trim() || undefined

  const serverStats = useConvexQuery(
    api.surveys.queries.commandCenterStats,
    authReady && scopeReady && Number.isFinite(nowMs)
      ? {
          wardNo: scopeFilters.wardNo,
          districtId: scopeFilters.districtId as Id<"districts"> | undefined,
          municipalityId: scopeFilters.municipalityId as Id<"municipalities"> | undefined,
          status: scopeFilters.status,
          qcStatus: scopeFilters.qcStatus,
          fromMs: fromDateMs,
          toMs: toDateMs,
          nowMs,
        }
      : "skip"
  )

  const resolvedStats = serverStats ?? (mode === "command" ? options.seedStats : undefined)

  const paginated = useSurveyListPaginated(
    {
      ...scopeFilters,
      ...tabFilters,
      fromMs: fromDateMs,
      toMs: toDateMs,
      searchTerm: surveyorSearchTerm,
    },
    pageSize,
    scopeReady && mode === "registry",
    options.seedNowMs
  )

  const isLoading =
    mode === "registry"
      ? paginated.isLoading && options.seedRegistryPage === undefined
      : scopeReady
        ? resolvedStats === undefined
        : false

  const filteredByTab = useMemo((): SurveyDataTableRow[] => {
    if (mode === "registry") {
      const rows = paginated.surveys ?? options.seedRegistryPage?.page
      return (rows ?? []) as SurveyDataTableRow[]
    }
    return []
  }, [mode, paginated.surveys, options.seedRegistryPage])

  const stats = useMemo((): SurveyQueueStats => {
    if (!resolvedStats) return EMPTY_STATS
    return {
      total: resolvedStats.total,
      drafts: resolvedStats.drafts,
      submitted: resolvedStats.submitted,
      submittedToday: resolvedStats.submittedToday,
      qcApproved: resolvedStats.qcApproved,
      qcPending: resolvedStats.qcPending,
      qcRejected: resolvedStats.qcRejected,
      surveyCompletionPct: resolvedStats.surveyCompletionPct,
    }
  }, [resolvedStats])

  const wardStats = useMemo((): SurveyWardRow[] => {
    if (resolvedStats?.wardStats) {
      return enrichServerSurveyWardStats(resolvedStats.wardStats, wardLabels)
    }
    return []
  }, [resolvedStats, wardLabels])

  const filteredCount =
    mode === "registry"
      ? (paginated.totalCount ?? options.seedRegistryPage?.totalCount ?? filteredByTab.length)
      : filteredByTab.length

  return {
    scope,
    dateFilters,
    surveyorSearch,
    activeTab,
    pageNumber: mode === "registry" ? paginated.pageNumber : 1,
    pageSize,
    pageStart: mode === "registry" ? (paginated.pageNumber - 1) * pageSize : 0,
    isLoading,
    stats,
    wardStats,
    filteredByTab,
    filteredCount,
    scopeTruncated: mode === "registry" ? Boolean(paginated.scopeTruncated) : false,
    pagedRows: filteredByTab,
    canGoPrev: paginated.canGoPrev,
    canGoNext: paginated.canGoNext,
    canViewAll,
    handleScopeChange,
    handleDateFiltersChange,
    handleSurveyorSearchChange,
    patchScope,
    handleTabChange,
    handlePageSizeChange,
    goNext: paginated.goNext,
    goPrev: paginated.goPrev,
  }
}
