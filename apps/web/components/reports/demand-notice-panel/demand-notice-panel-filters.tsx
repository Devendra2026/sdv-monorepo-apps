"use client";

import { SectionHeader } from "@/components/design-system/executive-hero";
import { GlassCard } from "@/components/design-system/glass-card";
import { SurveyFilters, type FilterState } from "@/components/surveys/survey-filters";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatReportDocumentDate, reportDocumentTimestamp } from "@/lib/qc/report-dates";
import { Building2, CalendarDays } from "lucide-react";

export function DemandNoticePanelFilters({
  value,
  onChange,
  requiresMunicipality,
}: {
  value: FilterState;
  onChange: (next: FilterState) => void;
  requiresMunicipality: boolean;
}) {
  const reportDate = formatReportDocumentDate(reportDocumentTimestamp());

  return (
    <GlassCard padding="md">
      <SectionHeader
        title="Filter Scope"
        description="QC-approved properties by district, ULB, and ward"
        className="mb-4"
      />
      <SurveyFilters variant="scope-only" value={value} onChange={onChange} />
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
        <CalendarDays className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <span>
          Notice date: <strong className="font-semibold text-foreground">{reportDate}</strong> (current date — not QC
          approval date)
        </span>
      </div>
      {requiresMunicipality ? (
        <Alert className="mt-4 border-primary/30 bg-primary/5">
          <Building2 className="h-4 w-4" />
          <AlertTitle>Select a ULB</AlertTitle>
          <AlertDescription>
            Demand calculations require a municipality because ward/ULB tax rates are municipality scoped.
          </AlertDescription>
        </Alert>
      ) : null}
    </GlassCard>
  );
}
