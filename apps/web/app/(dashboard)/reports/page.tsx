"use client";

import { ExecutiveHero, SectionHeader } from "@/components/design-system/executive-hero";
import { GlassCard, GlassCardHeader } from "@/components/design-system/glass-card";
import { MetricCard } from "@/components/design-system/metric-card";
import { PageTransition } from "@/components/design-system/motion";
import { CardsSkeleton } from "@/components/shared/loading";
import { RoleGate } from "@/components/shared/role-gate";
import { SurveyExcelActions } from "@/components/surveys/survey-excel-actions";
import { SurveyFilters, type FilterState } from "@/components/surveys/survey-filters";
import { Button } from "@workspace/ui/components/button";
import { useStatsBreakdown } from "@/hooks/analytics/useAnalytics";
import {
  Building2,
  Download,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  LayoutTemplate,
  Loader2,
  Save,
  ScrollText,
  Users as UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const SAVED_REPORTS = [
  { id: "1", name: "Monthly ULB Summary", type: "PDF", updated: "2 days ago" },
  { id: "2", name: "Surveyor Performance Q1", type: "Excel", updated: "1 week ago" },
  { id: "3", name: "Ward Coverage Analysis", type: "Dashboard", updated: "2 weeks ago" },
];

export default function ReportsPage() {
  const [filters, setFilters] = useState<FilterState>({ search: "" });
  const breakdown = useStatsBreakdown({ districtId: filters.districtId, municipalityId: filters.municipalityId });
  const ready = !!breakdown;
  const [pdfExporting, setPdfExporting] = useState<"municipality" | "surveyor" | null>(null);
  const [excelExporting, setExcelExporting] = useState(false);

  const exportFilters = useMemo(
    () => ({
      districtId: filters.districtId,
      municipalityId: filters.municipalityId,
      wardNo: filters.wardNo,
    }),
    [filters],
  );

  async function onMunicipalityPdf() {
    if (!breakdown) return;
    setPdfExporting("municipality");
    try {
      const { generateMunicipalitySummaryPdf } = await import("@/components/reports/queries/pdf");
      generateMunicipalitySummaryPdf(breakdown);
    } finally {
      setPdfExporting(null);
    }
  }

  async function onSurveyorPdf() {
    if (!breakdown) return;
    setPdfExporting("surveyor");
    try {
      const { generateSurveyorPerformancePdf } = await import("@/components/reports/queries/pdf");
      generateSurveyorPerformancePdf(breakdown);
    } finally {
      setPdfExporting(null);
    }
  }

  async function onBreakdownExcel() {
    if (!breakdown) return;
    setExcelExporting(true);
    try {
      const { exportBreakdownExcel } = await import("@/components/reports/queries/exporters");
      exportBreakdownExcel(breakdown);
    } finally {
      setExcelExporting(false);
    }
  }

  return (
    <RoleGate
      mode="page"
      capability="reports.export"
      deniedDescription="Reporting is available to supervisors and administrators."
    >
      <PageTransition className="space-y-6">
        <ExecutiveHero
          eyebrow="Reports & Analytics"
          title="Report Builder"
          description="Generate, save, and export survey, municipality, and surveyor reports. PDF, Excel, and dashboard exports."
          icon={FileBarChart}
          gradient="red"
        />

        <GlassCard padding="md">
          <SectionHeader title="Report Scope" description="Filter data before export" className="mb-4" />
          <SurveyFilters variant="scope-and-dates" value={filters} onChange={setFilters} />
        </GlassCard>

        {breakdown === undefined ? (
          <CardsSkeleton count={4} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <MetricCard label="Surveys (scope)" value={breakdown.summary.total} icon={FileText} />
            <MetricCard label="Approved" value={breakdown.summary.approved} tone="success" icon={FileBarChart} />
            <MetricCard label="Rejected" value={breakdown.summary.rejected} tone="destructive" icon={FileSpreadsheet} />
            <MetricCard label="Municipalities" value={breakdown.byUlb.length} tone="info" icon={Building2} />
          </div>
        )}

        <div className="enterprise-grid">
          <div className="col-span-12 lg:col-span-8">
            <SectionHeader title="Visual Report Builder" description="Configure and export reports" className="mb-4" />
            <div className="grid gap-4 sm:grid-cols-2">
              <GlassCard padding="md" hover>
                <GlassCardHeader
                  icon={<FileText className="h-4 w-4" aria-hidden />}
                  title="Survey Report"
                  description="Full mobile survey data for current filter scope."
                />
                <SurveyExcelActions filters={exportFilters} canImport />
              </GlassCard>

              <GlassCard padding="md" hover>
                <GlassCardHeader
                  icon={<Building2 className="h-4 w-4" aria-hidden />}
                  title="Municipality Summary"
                  description="Per-ULB totals and approval rates."
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!ready || pdfExporting !== null}
                    className="cursor-pointer gap-1.5"
                    onClick={() => void onMunicipalityPdf()}
                  >
                    {pdfExporting === "municipality" ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <FileBarChart className="h-4 w-4" aria-hidden />
                    )}
                    PDF Export
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!ready || excelExporting}
                    className="cursor-pointer gap-1.5"
                    onClick={() => void onBreakdownExcel()}
                  >
                    {excelExporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4" aria-hidden />
                    )}
                    Excel Export
                  </Button>
                </div>
              </GlassCard>

              <GlassCard padding="md" hover>
                <GlassCardHeader
                  icon={<UsersIcon className="h-4 w-4" aria-hidden />}
                  title="Surveyor Performance"
                  description="Per-surveyor productivity and approval %."
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!ready || pdfExporting !== null}
                  className="cursor-pointer gap-1.5"
                  onClick={() => void onSurveyorPdf()}
                >
                  {pdfExporting === "surveyor" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <FileBarChart className="h-4 w-4" aria-hidden />
                  )}
                  PDF Export
                </Button>
              </GlassCard>

              <GlassCard padding="md" hover>
                <GlassCardHeader
                  icon={<LayoutTemplate className="h-4 w-4" aria-hidden />}
                  title="QC Final Report"
                  description="Ward-wise register of QC-approved properties with printable final reports."
                />
                <Button asChild variant="outline" size="sm" className="cursor-pointer gap-1.5">
                  <Link href="/reports/qc-final">Open Ward Register</Link>
                </Button>
              </GlassCard>

              <GlassCard padding="md" hover>
                <GlassCardHeader
                  icon={<ScrollText className="h-4 w-4" aria-hidden />}
                  title="Demand Notice Panel"
                  description="Filtered demand register with printable property notices."
                />
                <Button asChild variant="outline" size="sm" className="cursor-pointer gap-1.5">
                  <Link href="/reports/demand-notices">Open Panel</Link>
                </Button>
              </GlassCard>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4">
            <SectionHeader title="Saved Reports" description="Quick access to recent exports" className="mb-4" />
            <GlassCard padding="md">
              <ul className="space-y-2">
                {SAVED_REPORTS.map((report) => (
                  <li
                    key={report.id}
                    className="flex cursor-pointer items-center justify-between rounded-xl border border-border/50 px-3 py-2.5 transition-colors duration-200 hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{report.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {report.type} · {report.updated}
                      </p>
                    </div>
                    <Save className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  </li>
                ))}
              </ul>
              <Button variant="outline" size="sm" className="mt-4 w-full cursor-pointer gap-1.5" disabled>
                <Download className="h-4 w-4" aria-hidden />
                Dashboard Export (coming soon)
              </Button>
            </GlassCard>
          </div>
        </div>
      </PageTransition>
    </RoleGate>
  );
}
