import type { SurveyRow } from "@/components/surveys/survey-tables";

function isSurveyPendingQc(row: Pick<SurveyRow, "qcStatus" | "status">): boolean {
  return row.qcStatus === "pending" && row.status === "submitted";
}

/** Next pending survey in ward queue after the current one (list is pre-sorted by property ID). */
export function findNextPendingSurvey(rows: SurveyRow[], currentId: string): SurveyRow | undefined {
  const pending = rows.filter(isSurveyPendingQc);
  const idx = pending.findIndex((r) => r._id === currentId);
  if (idx < 0) return pending[0];
  return pending[idx + 1];
}

function countPendingQc(rows: SurveyRow[]): number {
  return rows.filter(isSurveyPendingQc).length;
}
