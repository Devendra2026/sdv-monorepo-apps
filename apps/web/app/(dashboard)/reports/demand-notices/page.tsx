"use client"

import {
  DemandNoticeBulkPdfCapture,
  DemandNoticePanelFilters,
  DemandNoticePanelHero,
  DemandNoticePanelKpis,
  DemandNoticePreviewSheet,
  DemandNoticeRegisterPrint,
  DemandNoticeRegisterTable,
} from "@/components/reports/demand-notice-panel"
import { RoleGate } from "@/components/shared/role-gate"
import { TablePagination } from "@/components/shared/table-pagination"
import { useDemandNoticePanel, type DemandRegisterRow } from "@/hooks/qc/useDemandNoticePanel"
import { useDemandNoticeBulkPdf } from "@/hooks/reports/useDemandNoticeBulkPdf"
import { useDemandRegisterPrint } from "@/hooks/reports/useDemandRegisterPrint"
import { formatInr } from "@/lib/qc/demand-estimate"
import { QC_TABLE_PAGE_SIZE_OPTIONS } from "@/lib/table-pagination"
import { Button } from "@workspace/ui/components/button"
import { FileDown, Loader2, Printer } from "lucide-react"
import { useMemo, useState } from "react"

function buildScopeLabel(filters: { districtId?: string; municipalityId?: string; wardNo?: string }) {
  const parts = []
  if (filters.districtId) parts.push("District selected")
  if (filters.municipalityId) parts.push("ULB selected")
  if (filters.wardNo) parts.push(`Ward ${filters.wardNo}`)
  return parts.length > 0 ? parts.join(" · ") : "All accessible scope"
}

function DemandNoticeReportContent() {
  const [previewRow, setPreviewRow] = useState<DemandRegisterRow | null>(null)
  const {
    filters,
    setFilters,
    rows,
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
    requiresMunicipality,
    reportDateLabel,
  } = useDemandNoticePanel()
  const { printRegister } = useDemandRegisterPrint()
  const { job, preparing, progress, startBulkPdf, onProgress, onComplete, onError, isExporting } =
    useDemandNoticeBulkPdf()
  const scopeLabel = useMemo(
    () =>
      buildScopeLabel({
        districtId: filters.districtId,
        municipalityId: filters.municipalityId,
        wardNo: filters.wardNo,
      }),
    [filters.districtId, filters.municipalityId, filters.wardNo]
  )

  return (
    <>
      <div className="demand-notice-panel-screen space-y-6">
        <DemandNoticePanelHero />
        <DemandNoticePanelFilters value={filters} onChange={setFilters} requiresMunicipality={requiresMunicipality} />
        <p className="text-xs text-muted-foreground print:hidden">
          Register lists QC-approved property surveys with owner, parcel, floor, and tax assessment data — not QC
          decision records alone.
        </p>
        <DemandNoticePanelKpis
          propertyCount={totals.propertyCount}
          totalAnnualDemand={totals.totalAnnualDemand}
          avgDemand={totals.avgDemand}
        />

        <section className="rounded-xl border border-border/70 bg-card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div>
              <p className="text-sm font-semibold">Demand Register</p>
              <p className="text-xs text-muted-foreground">Scope: {scopeLabel}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="default"
                onClick={() => void startBulkPdf(filters)}
                disabled={isExporting || requiresMunicipality || totalCount === 0}
              >
                {isExporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4" />
                )}
                {progress
                  ? `Generating PDF ${progress.completed}/${progress.total}`
                  : preparing
                    ? "Preparing…"
                    : "Download Bulk PDF (A4)"}
              </Button>
              <Button variant="outline" onClick={printRegister} disabled={rows.length === 0 || isExporting}>
                <Printer className="mr-2 h-4 w-4" /> Print Register
              </Button>
            </div>
          </div>

          {isLoading ? (
            <p className="py-8 text-sm text-muted-foreground">Loading demand register...</p>
          ) : (
            <DemandNoticeRegisterTable rows={rows} onPreview={setPreviewRow} />
          )}
          <TablePagination
            pageNumber={pageNumber}
            pageSize={pageSize}
            itemCount={rows.length}
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
            onPrev={goPrev}
            onNext={goNext}
            pageSizeOptions={[...QC_TABLE_PAGE_SIZE_OPTIONS]}
            onPageSizeChange={setPageSize}
            className="print:hidden"
          />
          <p className="mt-2 text-xs text-muted-foreground print:hidden">
            {totalCount.toLocaleString()} matching properties in scope. Bulk PDF exports all properties in scope, sorted
            ward-wise then parcel number.
          </p>
        </section>
      </div>

      {job ? (
        <DemandNoticeBulkPdfCapture job={job} onProgress={onProgress} onComplete={onComplete} onError={onError} />
      ) : null}

      <DemandNoticeRegisterPrint
        rows={rows}
        scopeLabel={scopeLabel}
        totalAnnualDemandLabel={formatInr(totals.totalAnnualDemand)}
        reportDateLabel={reportDateLabel}
      />

      <DemandNoticePreviewSheet
        row={previewRow}
        open={!!previewRow}
        onOpenChange={(open) => !open && setPreviewRow(null)}
      />
    </>
  )
}

export default function DemandNoticeReportPage() {
  return (
    <RoleGate
      mode="page"
      capability="reports.export"
      deniedDescription="Demand notice reports are available to supervisors and administrators."
    >
      <DemandNoticeReportContent />
    </RoleGate>
  )
}
