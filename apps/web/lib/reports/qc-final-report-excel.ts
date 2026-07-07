/**
 * QC Final Report Excel export — single worksheet of QC-approved surveys.
 * Read-only client export; does not use the multi-sheet survey import format.
 */
import type { MasterOption } from "@/convex/areaMasters";
import { QC_STATUS_LABEL, SURVEY_STATUS_LABEL } from "@/lib/domain";
import type { TaxRateConfig } from "@/lib/qc/demand-notice";
import { getQcReportDemand } from "@/lib/qc/qc-report-demand";
import { resolveDisplayPropertyId } from "@/lib/survey/resolve-display-property-id";
import type { SurveyExportBundle } from "@/lib/survey/survey-excel";
import { fmtDate } from "@/lib/utils";
import type { FloorRow, SurveyDetail } from "@/schema/surveys/index";
import * as XLSX from "xlsx";

export const QC_FINAL_REPORT_SHEET = "QC Final Report";

export const QC_FINAL_EXPORT_SCOPE_LIMIT = 5000;

type DemandMasters = {
  floors?: MasterOption[];
  usageTypes?: MasterOption[];
  usageFactors?: MasterOption[];
  constructionTypes?: MasterOption[];
};

export type QcFinalReportExcelRow = {
  "Property ID": string;
  Owner: string;
  Ward: string;
  Parcel: string;
  Unit: string;
  District: string;
  Municipality: string;
  Locality: string;
  "Assessable sqft": number;
  "Plot sqft": number;
  "Plinth sqft": number;
  "Property Tax": number;
  "Water Tax": number;
  "Drainage Tax": number;
  "Total Annual Demand": number;
  "Survey Status": string;
  "QC Status": string;
  "Submitted At": string;
  Surveyor: string;
};

export function bundleToQcFinalReportRow(
  bundle: SurveyExportBundle,
  ulbCodeByMunicipalityId: Map<string, string>,
  rateConfigByMunicipality?: Map<string, TaxRateConfig | null>,
  masters?: DemandMasters,
): QcFinalReportExcelRow {
  const ownerName = bundle.respondentName || bundle.owners?.[0]?.name || "—";
  const propertyId = resolveDisplayPropertyId(bundle, ulbCodeByMunicipalityId) ?? bundle.propertyId ?? "—";
  const floors = (bundle.floors ?? []) as FloorRow[];
  const rateConfig = rateConfigByMunicipality?.get(bundle.municipalityId) ?? null;
  const demand = getQcReportDemand(bundle as unknown as SurveyDetail, floors, masters, rateConfig);

  const propertyTax = demand.lines.find((l) => l.label === "Property Tax")?.amount ?? 0;
  const waterTax = demand.lines.find((l) => l.label === "Water Tax")?.amount ?? 0;
  const drainageTax = demand.lines.find((l) => l.label === "Drainage Tax")?.amount ?? 0;

  return {
    "Property ID": propertyId,
    Owner: ownerName,
    Ward: bundle.wardNo || "—",
    Parcel: bundle.parcelNo || "—",
    Unit: bundle.unitNo || "—",
    District: bundle.districtName || "—",
    Municipality: bundle.municipalityName || bundle.city || "—",
    Locality: bundle.locality || "—",
    "Assessable sqft": demand.assessableSqft,
    "Plot sqft": bundle.plotSqft ?? 0,
    "Plinth sqft": bundle.plinthSqft ?? 0,
    "Property Tax": propertyTax,
    "Water Tax": waterTax,
    "Drainage Tax": drainageTax,
    "Total Annual Demand": demand.total,
    "Survey Status": SURVEY_STATUS_LABEL[bundle.status as keyof typeof SURVEY_STATUS_LABEL] ?? bundle.status,
    "QC Status": QC_STATUS_LABEL[bundle.qcStatus as keyof typeof QC_STATUS_LABEL] ?? bundle.qcStatus,
    "Submitted At": bundle.submittedAt ? fmtDate(bundle.submittedAt) : "—",
    Surveyor: bundle.surveyorName || bundle.surveyorEmail || "—",
  };
}

export function bundlesToQcFinalReportRows(
  bundles: SurveyExportBundle[],
  ulbCodeByMunicipalityId: Map<string, string>,
  rateConfigByMunicipality?: Map<string, TaxRateConfig | null>,
  masters?: DemandMasters,
): QcFinalReportExcelRow[] {
  return bundles
    .filter((b) => b.qcStatus === "approved")
    .map((bundle) => bundleToQcFinalReportRow(bundle, ulbCodeByMunicipalityId, rateConfigByMunicipality, masters));
}

export function buildQcFinalReportExcelFilename(parts: {
  municipalityLabel?: string;
  wardNo?: string;
  date?: string;
}): string {
  const date = parts.date ?? new Date().toISOString().slice(0, 10);
  const slug = [parts.municipalityLabel, parts.wardNo ? `ward-${parts.wardNo}` : undefined]
    .filter(Boolean)
    .join("_")
    .replace(/[^\w-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 48);
  return slug ? `qc_final_report_${slug}_${date}.xlsx` : `qc_final_report_${date}.xlsx`;
}

/** Writes a single-worksheet workbook and triggers browser download. */
export function exportQcFinalReportExcel(rows: QcFinalReportExcelRow[], filename: string): void {
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, sheet, QC_FINAL_REPORT_SHEET);
  XLSX.writeFile(wb, filename);
}

/** Test helper — returns sheet names without writing a file. */
export function qcFinalReportWorkbookSheetNames(rows: QcFinalReportExcelRow[]): string[] {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), QC_FINAL_REPORT_SHEET);
  return wb.SheetNames;
}
