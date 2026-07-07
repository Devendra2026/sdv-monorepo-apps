"use client";

import { SectionHeader } from "@/components/design-system/executive-hero";
import { GlassCard } from "@/components/design-system/glass-card";
import { SurveyFilters, type FilterState } from "@/components/surveys/survey-filters";
import { formatReportDocumentDate, reportDocumentTimestamp } from "@/lib/qc/report-dates";
import { CalendarDays } from "lucide-react";

export function QcFinalReportPanelFilters({
  value,
  onChange,
}: {
  value: FilterState;
  onChange: (next: FilterState) => void;
}) {
  const reportDate = formatReportDocumentDate(reportDocumentTimestamp());

  return (
    <GlassCard padding="md">
      <SectionHeader
        title="Filter Scope"
        description="District, ULB, and ward — lists all QC-approved properties in scope"
        className="mb-4"
      />
      <SurveyFilters variant="scope-only" value={value} onChange={onChange} />
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
        <CalendarDays className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <span>
          Report date: <strong className="font-semibold text-foreground">{reportDate}</strong> (current date — not QC
          approval date)
        </span>
      </div>
    </GlassCard>
  );
}
