"use client";

import { ExecutiveHero } from "@/components/design-system/executive-hero";
import type { FilterState } from "@/components/surveys/survey-filters";
import { formatReportDocumentDate, reportDocumentTimestamp } from "@/lib/qc/report-dates";
import { ShieldCheck } from "lucide-react";
import { QcFinalReportExportButton } from "./qc-final-report-export-button";

export function QcFinalReportPanelHero({
  filters,
  exportDisabled,
}: {
  filters?: FilterState;
  exportDisabled?: boolean;
}) {
  const reportDate = formatReportDocumentDate(reportDocumentTimestamp());

  return (
    <ExecutiveHero
      eyebrow="Reports"
      title="QC Final Report"
      description={`Ward-wise register of QC-approved properties. Report date: ${reportDate}.`}
      icon={ShieldCheck}
      gradient="brand"
      actions={filters ? <QcFinalReportExportButton filters={filters} disabled={exportDisabled} /> : undefined}
    />
  );
}
