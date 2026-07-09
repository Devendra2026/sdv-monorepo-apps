"use client";

import {
  QcFinalReportPanelFilters,
  QcFinalReportPanelHero,
  QcFinalReportPanelKpis,
  QcFinalReportWardList,
} from "@/components/reports/qc-final-report-panel";
import { RoleGate } from "@/components/shared/role-gate";
import { TablePagination } from "@/components/shared/table-pagination";
import { useQcFinalReportPanel } from "@/hooks/reports/useQcFinalReportPanel";
import { QC_TABLE_PAGE_SIZE_OPTIONS } from "@/lib/table-pagination";

function QcFinalReportContent() {
  const {
    filters,
    setFilters,
    wardGroups,
    totals,
    pageSize,
    setPageSize,
    pageNumber,
    canGoPrev,
    canGoNext,
    goPrev,
    goNext,
    isLoading,
    totalCount,
    reportDateLabel,
  } = useQcFinalReportPanel();

  return (
    <div className="space-y-6">
      <QcFinalReportPanelHero filters={filters} exportDisabled={isLoading} />
      <QcFinalReportPanelFilters value={filters} onChange={setFilters} />
      <QcFinalReportPanelKpis
        propertyCount={totals.propertyCount}
        wardCount={totals.wardCount}
        reportDateLabel={reportDateLabel}
      />

      <section className="rounded-xl border border-border/70 bg-card p-4 sm:p-5">
        <div className="mb-4">
          <p className="text-sm font-semibold">Ward-wise QC Final Register</p>
          <p className="text-xs text-muted-foreground">
            Expand each ward to open individual QC final reports. Report date: {reportDateLabel}.
          </p>
        </div>

        {isLoading ? (
          <p className="py-8 text-sm text-muted-foreground">Loading QC-approved properties…</p>
        ) : (
          <QcFinalReportWardList wardGroups={wardGroups} />
        )}

        <TablePagination
          pageNumber={pageNumber}
          pageSize={pageSize}
          itemCount={totals.propertyCount}
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
          onPrev={goPrev}
          onNext={goNext}
          pageSizeOptions={[...QC_TABLE_PAGE_SIZE_OPTIONS]}
          onPageSizeChange={setPageSize}
          className="mt-4 print:hidden"
        />
        <p className="mt-2 text-xs text-muted-foreground print:hidden">
          {totalCount.toLocaleString()} QC-approved properties in scope.
        </p>
      </section>
    </div>
  );
}

export default function QcFinalReportPage() {
  return (
    <RoleGate
      mode="page"
      capability="reports.export"
      deniedDescription="QC final reports are available to supervisors and administrators."
    >
      <QcFinalReportContent />
    </RoleGate>
  );
}
