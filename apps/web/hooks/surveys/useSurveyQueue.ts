"use client";

import type { DateFilterState } from "@/components/surveys/survey-filters";
import { api } from "@workspace/backend/convex/_generated/api.js";
import type { Id } from "@workspace/backend/convex/_generated/dataModel.js";
import { useMasters, useWardsForMunicipality } from "@/hooks/masters/useMasters";
import { useSurveyWorkScope } from "@/hooks/surveys/useSurveyWorkScope";
import { useSurveyList, useSurveyListPaginated } from "@/hooks/surveys/useSurveys";
import { useHasCapability } from "@/hooks/use-capability";
import { useClientNowMs } from "@/hooks/use-client-now";
import { useConvexAuthReady } from "@/hooks/use-convex-auth-ready";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { QcStatus, SurveyStatus } from "@/lib/domain";
import { sanitizeSurveyWorkScope, type SurveyWorkScope } from "@/lib/survey/work-scope";
import { surveyTabToListFilters } from "@/lib/surveys/survey-list-filters";
import {
  computeSurveyWardStats,
  enrichServerSurveyWardStats,
  type SurveyWardRow,
  type SurveyWardSourceRow,
} from "@/lib/surveys/ward-stats";
import { useQuery as useConvexQuery } from "convex/react";
import { useCallback, useMemo, useState } from "react";

const SURVEY_AGGREGATE_LIMIT = 500;

export type SurveyQueueStats = {
  total: number;
  drafts: number;
  submitted: number;
  submittedToday: number;
  qcApproved: number;
  qcPending: number;
  qcRejected: number;
  surveyCompletionPct: number;
};

const EMPTY_STATS: SurveyQueueStats = {
  total: 0,
  drafts: 0,
  submitted: 0,
  submittedToday: 0,
  qcApproved: 0,
  qcPending: 0,
  qcRejected: 0,
  surveyCompletionPct: 0,
};

export type UseSurveyQueueOptions = {
  initialTab?: string;
  mode?: "command" | "registry";
};

export function useSurveyQueue(options: UseSurveyQueueOptions = {}) {
  const mode = options.mode ?? "registry";
  const canViewAll = useHasCapability("surveys.viewAll");
  const { scope, setScope, patchScope, scopeReady } = useSurveyWorkScope();
  const { masters } = useMasters();
  const authReady = useConvexAuthReady();
  const nowMs = useClientNowMs();

  const queryScope = useMemo(() => {
    if (masters) {
      return sanitizeSurveyWorkScope(scope, {
        municipalityIds: new Set(masters.ulbs.map((u) => u._id)),
        districtIds: new Set(masters.districts.map((d) => d._id)),
      });
    }
    return scope;
  }, [scope, masters]);

  const [dateFilters, setDateFilters] = useState<DateFilterState>({});
  const [surveyorSearch, setSurveyorSearch] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [activeTab, setActiveTab] = useState(options.initialTab ?? "all");

  const wardsForMuni = useWardsForMunicipality(scopeReady ? queryScope.municipalityId : undefined);
  const wardLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of wardsForMuni ?? []) {
      if (w.wardNo && w.name) map.set(w.wardNo, w.name);
    }
    return map;
  }, [wardsForMuni]);

  const handleScopeChange = useCallback(
    (next: SurveyWorkScope) => {
      setScope(next);
    },
    [setScope],
  );

  const handleDateFiltersChange = useCallback((next: DateFilterState) => {
    setDateFilters(next);
  }, []);

  const handleSurveyorSearchChange = useCallback((term: string) => {
    setSurveyorSearch(term);
  }, []);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
  }, []);

  const scopeFilters = useMemo(
    () => ({
      wardNo: queryScope.wardNo,
      districtId: queryScope.districtId,
      municipalityId: queryScope.municipalityId,
      status: queryScope.status as SurveyStatus | undefined,
      qcStatus: queryScope.qcStatus as QcStatus | undefined,
    }),
    [queryScope],
  );

  const fromDateMs = useMemo(
    () => (dateFilters.fromDate ? new Date(`${dateFilters.fromDate}T00:00:00`).getTime() : undefined),
    [dateFilters.fromDate],
  );
  const toDateMs = useMemo(
    () => (dateFilters.toDate ? new Date(`${dateFilters.toDate}T23:59:59.999`).getTime() : undefined),
    [dateFilters.toDate],
  );

  const tabFilters = useMemo(() => surveyTabToListFilters(activeTab), [activeTab]);
  const debouncedSurveyorSearch = useDebouncedValue(surveyorSearch, 300);
  const surveyorSearchTerm = debouncedSurveyorSearch.trim() || undefined;

  const serverStats = useConvexQuery(
    api.survey.commandCenterStats,
    authReady && scopeReady
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
      : "skip",
  );

  const needsAggregateFallback = mode === "command" && serverStats === undefined;
  const aggregateSurveys = useSurveyList(
    scopeReady && needsAggregateFallback ? { ...scopeFilters, limit: SURVEY_AGGREGATE_LIMIT } : {},
    scopeReady && needsAggregateFallback,
  );

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
  );

  const isLoading =
    mode === "registry"
      ? paginated.isLoading
      : scopeReady
        ? serverStats === undefined && aggregateSurveys === undefined
        : false;

  const filteredByTab = useMemo((): SurveyDataTableRow[] => {
    if (mode === "registry") return (paginated.surveys ?? []) as SurveyDataTableRow[];
    const rows = (aggregateSurveys ?? []) as SurveyDataTableRow[];
    if (activeTab === "draft") return rows.filter((r) => r.status === "draft");
    if (activeTab === "submitted") return rows.filter((r) => r.status === "submitted");
    if (activeTab === "qcPending") return rows.filter((r) => r.qcStatus === "pending");
    if (activeTab === "qcApproved") return rows.filter((r) => r.qcStatus === "approved");
    if (activeTab === "qcRejected") return rows.filter((r) => r.qcStatus === "rejected");
    return rows;
  }, [mode, paginated.surveys, aggregateSurveys, activeTab]);

  const stats = useMemo((): SurveyQueueStats => {
    if (!serverStats) return EMPTY_STATS;
    return {
      total: serverStats.total,
      drafts: serverStats.drafts,
      submitted: serverStats.submitted,
      submittedToday: serverStats.submittedToday,
      qcApproved: serverStats.qcApproved,
      qcPending: serverStats.qcPending,
      qcRejected: serverStats.qcRejected,
      surveyCompletionPct: serverStats.surveyCompletionPct,
    };
  }, [serverStats]);

  const wardStats = useMemo((): SurveyWardRow[] => {
    if (serverStats?.wardStats) {
      return enrichServerSurveyWardStats(serverStats.wardStats, wardLabels);
    }
    return computeSurveyWardStats((aggregateSurveys ?? []) as SurveyWardSourceRow[], wardLabels);
  }, [serverStats, aggregateSurveys, wardLabels]);

  const filteredCount = mode === "registry" ? (paginated.totalCount ?? filteredByTab.length) : filteredByTab.length;

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
  };
}
