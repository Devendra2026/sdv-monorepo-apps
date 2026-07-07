"use client";

import type { FilterState } from "@/components/surveys/survey-filters";
import { useMasters, useWardsForMunicipality } from "@/hooks/masters/useMasters";
import { useSurveyListPaginated } from "@/hooks/surveys/useSurveys";
import { formatReportDocumentDate, reportDocumentTimestamp } from "@/lib/qc/report-dates";
import { groupSurveysByWard } from "@/lib/reports/group-by-ward";
import { buildUlbCodeMap, resolveDisplayPropertyId } from "@/lib/survey/resolve-display-property-id";
import { QC_TABLE_PAGE_SIZE_OPTIONS } from "@/lib/table-pagination";
import type { SurveyListItem } from "@/schema/surveys/index";
import { useMemo, useState } from "react";

export type QcFinalReportRow = {
  surveyId: string;
  propertyId: string;
  ownerName: string;
  wardNo: string;
  parcelNo: string;
  assessableSqft: number;
  survey: SurveyListItem;
};

export function useQcFinalReportPanel() {
  const [filters, setFilters] = useState<FilterState>({});
  const [pageSize, setPageSize] = useState<number>(QC_TABLE_PAGE_SIZE_OPTIONS[1] ?? 20);
  const { masters } = useMasters();
  const ulbCodes = useMemo(() => buildUlbCodeMap(masters?.ulbs), [masters?.ulbs]);
  const wards = useWardsForMunicipality(filters.municipalityId);
  const reportDateMs = reportDocumentTimestamp();
  const reportDateLabel = formatReportDocumentDate(reportDateMs);

  const wardLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const ward of wards ?? []) {
      if (ward.name) map.set(ward.wardNo, ward.name);
    }
    return map;
  }, [wards]);

  const paginated = useSurveyListPaginated(
    {
      qcStatus: "approved",
      districtId: filters.districtId,
      municipalityId: filters.municipalityId,
      wardNo: filters.wardNo,
    },
    pageSize,
  );

  const rows = useMemo((): QcFinalReportRow[] => {
    return (paginated.surveys ?? []).map((survey) => {
      const ownerName = survey.respondentName || survey.owners?.[0]?.name || "—";
      const propertyId = resolveDisplayPropertyId(survey, ulbCodes) ?? survey.propertyId ?? "—";
      const assessableSqft = survey.plinthSqft ?? survey.plotSqft ?? 0;
      return {
        surveyId: survey._id,
        propertyId,
        ownerName,
        wardNo: survey.wardNo || "—",
        parcelNo: survey.parcelNo || "—",
        assessableSqft,
        survey,
      };
    });
  }, [paginated.surveys, ulbCodes]);

  const wardGroups = useMemo(
    () => groupSurveysByWard(paginated.surveys ?? [], wardLabels),
    [paginated.surveys, wardLabels],
  );

  const wardGroupsWithRows = useMemo(() => {
    const rowById = new Map(rows.map((row) => [row.surveyId, row]));
    return wardGroups.map((group) => ({
      ...group,
      rows: group.items
        .map((item) => rowById.get(item._id))
        .filter((row): row is QcFinalReportRow => row !== undefined),
    }));
  }, [rows, wardGroups]);

  const totals = useMemo(() => {
    const propertyCount = rows.length;
    const wardCount = wardGroups.length;
    return { propertyCount, wardCount };
  }, [rows.length, wardGroups.length]);

  return {
    filters,
    setFilters,
    rows,
    wardGroups: wardGroupsWithRows,
    totals,
    pageSize,
    setPageSize,
    pageNumber: paginated.pageNumber,
    canGoPrev: paginated.canGoPrev,
    canGoNext: paginated.canGoNext,
    goPrev: paginated.goPrev,
    goNext: paginated.goNext,
    isLoading: paginated.isLoading,
    totalCount: paginated.totalCount ?? rows.length,
    reportDateLabel,
    reportDateMs,
  };
}
