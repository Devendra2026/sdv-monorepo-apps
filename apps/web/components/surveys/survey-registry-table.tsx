"use client";

import { SurveyDataTable, type SurveyDataTableRow } from "@/components/surveys/survey-data-table";
import { useMasters } from "@/hooks/masters/useMasters";
import { buildUlbCodeMap } from "@/lib/survey/resolve-display-property-id";
import { useMemo } from "react";

export type SurveyRegistryRow = SurveyDataTableRow;

export function SurveyRegistryTable({
  rows,
  pageStart = 0,
  hrefBase = "/surveys",
  showSurveyor = true,
}: {
  rows?: SurveyRegistryRow[];
  pageStart?: number;
  hrefBase?: string;
  showSurveyor?: boolean;
}) {
  const { masters } = useMasters();
  const ulbCodes = useMemo(() => buildUlbCodeMap(masters?.ulbs), [masters?.ulbs]);

  return (
    <SurveyDataTable
      rows={rows}
      pageStart={pageStart}
      hrefBase={hrefBase}
      ulbCodes={ulbCodes}
      showSurveyor={showSurveyor}
    />
  );
}
