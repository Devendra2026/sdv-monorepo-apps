"use client";

import type { FilterState } from "@/components/surveys/survey-filters";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMasters } from "@/hooks/masters/useMasters";
import { parseConvexError } from "@/lib/errors";
import type { TaxRateConfig } from "@/lib/qc/demand-notice";
import {
  buildQcFinalReportExcelFilename,
  bundlesToQcFinalReportRows,
  exportQcFinalReportExcel,
  QC_FINAL_EXPORT_SCOPE_LIMIT,
} from "@/lib/reports/qc-final-report-excel";
import { buildUlbCodeMap } from "@/lib/survey/resolve-display-property-id";
import type { SurveyExportBundle } from "@/lib/survey/survey-excel";
import { useConvex } from "convex/react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type QcFinalReportExportButtonProps = {
  filters: FilterState;
  disabled?: boolean;
};

export function QcFinalReportExportButton({ filters, disabled }: QcFinalReportExportButtonProps) {
  const convex = useConvex();
  const { masters } = useMasters();
  const ulbCodes = useMemo(() => buildUlbCodeMap(masters?.ulbs), [masters?.ulbs]);
  const [exporting, setExporting] = useState(false);

  async function loadRateConfigs(municipalityIds: string[]): Promise<Map<string, TaxRateConfig | null>> {
    const map = new Map<string, TaxRateConfig | null>();
    const unique = [...new Set(municipalityIds)];
    await Promise.all(
      unique.map(async (municipalityId) => {
        const rates = await convex.query(api.taxRates.getForMunicipality, {
          municipalityId: municipalityId as Id<"municipalities">,
        });
        map.set(municipalityId, rates);
      }),
    );
    return map;
  }

  async function onExport() {
    setExporting(true);
    const progress = toast.loading("Preparing QC Final Report export…");
    try {
      const queryArgs = {
        qcStatus: "approved" as const,
        wardNo: filters.wardNo,
        districtId: filters.districtId as Id<"districts"> | undefined,
        municipalityId: filters.municipalityId as Id<"municipalities"> | undefined,
      };

      const allBundles: SurveyExportBundle[] = [];
      let offset = 0;
      let total: number | undefined;

      while (true) {
        const page = await convex.query(api.surveyExport.listForExport, { ...queryArgs, offset });
        total = page.total;
        allBundles.push(...(page.bundles as SurveyExportBundle[]));
        toast.loading(
          `Loading ${allBundles.length.toLocaleString()} / ${(total ?? allBundles.length).toLocaleString()}…`,
          {
            id: progress,
          },
        );
        if (page.nextOffset === null) break;
        offset = page.nextOffset;
      }

      if (!allBundles.length) {
        toast.message("No QC-approved surveys to export for the current filters.", { id: progress });
        return;
      }

      if (total !== undefined && total > QC_FINAL_EXPORT_SCOPE_LIMIT) {
        toast.warning(
          `Export includes up to ${QC_FINAL_EXPORT_SCOPE_LIMIT.toLocaleString()} surveys (server scope limit). Narrow filters for a complete export.`,
          { id: progress, duration: 8000 },
        );
      }

      const municipalityIds = allBundles.map((b) => b.municipalityId);
      const rateConfigByMunicipality = await loadRateConfigs(municipalityIds);

      const rows = bundlesToQcFinalReportRows(allBundles, ulbCodes, rateConfigByMunicipality, masters ?? undefined);

      const municipalityLabel = filters.municipalityId
        ? masters?.ulbs?.find((u) => u._id === filters.municipalityId)?.name
        : undefined;

      const filename = buildQcFinalReportExcelFilename({
        municipalityLabel,
        wardNo: filters.wardNo,
      });

      exportQcFinalReportExcel(rows, filename);
      toast.success(`Exported ${rows.length.toLocaleString()} QC-approved survey(s) to Excel`, { id: progress });
    } catch (e) {
      toast.error(parseConvexError(e).message, { id: progress });
    } finally {
      setExporting(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="cursor-pointer"
      disabled={disabled || exporting}
      onClick={() => void onExport()}
    >
      {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
      {exporting ? "Exporting…" : "Export Excel"}
    </Button>
  );
}
