"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { QcStatus, SurveyStatus } from "@/lib/domain";
import { parseConvexError } from "@/lib/errors";
import { useConvex, useMutation } from "convex/react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

export type SurveyExportFilters = {
  status?: SurveyStatus;
  qcStatus?: QcStatus;
  wardNo?: string;
  districtId?: string;
  municipalityId?: string;
  surveyorId?: string;
};

export function SurveyExcelActions({
  filters,
  canImport = false,
  disabled,
}: {
  filters: SurveyExportFilters;
  canImport?: boolean;
  disabled?: boolean;
}) {
  const convex = useConvex();
  const importBundle = useMutation(api.surveyExport.importExcelBundle);
  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  async function onExport() {
    setExporting(true);
    try {
      const queryArgs = {
        status: filters.status,
        qcStatus: filters.qcStatus,
        wardNo: filters.wardNo,
        districtId: filters.districtId as Id<"districts"> | undefined,
        municipalityId: filters.municipalityId as Id<"municipalities"> | undefined,
        surveyorId: filters.surveyorId as Id<"users"> | undefined,
      };

      const allBundles = [];
      let offset = 0;
      let total: number | undefined;

      while (true) {
        const page = await convex.query(api.surveyExport.listForExport, { ...queryArgs, offset });
        total = page.total;
        allBundles.push(...page.bundles);
        if (page.nextOffset === null) break;
        offset = page.nextOffset;
      }

      if (!allBundles.length) {
        toast.message("No surveys to export for the current filters.");
        return;
      }
      const { exportSurveysFullExcel } = await import("@/lib/survey/survey-excel");
      exportSurveysFullExcel(allBundles as Parameters<typeof exportSurveysFullExcel>[0]);
      toast.success(`Exported ${total ?? allBundles.length} survey(s) to Excel`);
    } catch (e) {
      toast.error(parseConvexError(e).message);
    } finally {
      setExporting(false);
    }
  }

  async function onImportFile(file: File) {
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const { parseSurveyExcelFile } = await import("@/lib/survey/survey-excel");
      const payload = parseSurveyExcelFile(buffer);
      if (payload.surveys.length === 0) {
        toast.error("No valid survey rows found. Check the Surveys sheet and required columns.");
        return;
      }
      const result = await importBundle({
        surveys: payload.surveys as any,
        floors: payload.floors as any,
      });
      const errCount = result.errors.length;
      toast.success(
        `Import complete: ${result.created} created, ${result.updated} updated${errCount ? `, ${errCount} error(s)` : ""}.`,
      );
      if (errCount > 0) {
        console.warn("Survey import errors", result.errors);
        toast.message("Some rows failed — see browser console for details.");
      }
    } catch (e) {
      toast.error(parseConvexError(e).message);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" disabled={disabled || exporting} onClick={onExport}>
        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
        {exporting ? "Exporting…" : "Export Excel"}
      </Button>
      {canImport && (
        <>
          <input
            id="import-excel-file"
            aria-label="Import Excel file"
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImportFile(f);
            }}
          />
          <Button
            id="import-excel-button"
            variant="outline"
            disabled={disabled || importing}
            onClick={() => fileRef.current?.click()}
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {importing ? "Importing…" : "Import Excel"}
          </Button>
        </>
      )}
    </div>
  );
}
