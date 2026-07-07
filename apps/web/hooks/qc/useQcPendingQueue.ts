"use client";

import type { SurveyRow } from "@/components/surveys/survey-tables";
import { useSurveyList } from "@/hooks/surveys/useSurveys";
import type { QcWorkScope } from "@/lib/qc/work-scope";
import { useMemo } from "react";

/** Lightweight pending-QC list for review navigation (replaces 2000-row bulk load). */
export function useQcPendingQueue(scope: QcWorkScope, enabled = true): SurveyRow[] {
  const filters = useMemo(
    () => ({
      wardNo: scope.wardNo,
      districtId: scope.districtId,
      municipalityId: scope.municipalityId,
      status: "submitted" as const,
      qcStatus: "pending" as const,
      limit: 150,
    }),
    [scope.wardNo, scope.districtId, scope.municipalityId],
  );

  const surveys = useSurveyList(enabled ? filters : {});
  return useMemo(() => (surveys ?? []) as SurveyRow[], [surveys]);
}
