"use client";

import { exportSurveysFullExcel, type SurveyExportBundle } from "@/lib/survey/survey-excel";
import * as XLSX from "xlsx";

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

/** @deprecated Use exportSurveysFullExcel via SurveyExcelActions — loads full data from server. */
export function exportSurveysCsv(surveys: SurveyExportBundle[]) {
  exportSurveysFullExcel(surveys);
}

/** @deprecated Use exportSurveysFullExcel via SurveyExcelActions. */
export function exportSurveysExcel(surveys: SurveyExportBundle[]) {
  exportSurveysFullExcel(surveys);
}

export { exportSurveysFullExcel };

/** Multi-sheet workbook for the analytics breakdown (Municipality Summary). */
export function exportBreakdownExcel(breakdown: { byDistrict: any[]; byUlb: any[]; bySurveyor: any[]; summary: any }) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([breakdown.summary]), "Summary");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(breakdown.byDistrict), "By District");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(breakdown.byUlb), "By ULB");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(breakdown.bySurveyor), "By Surveyor");
  XLSX.writeFile(wb, `municipality_summary_${stamp()}.xlsx`);
}
