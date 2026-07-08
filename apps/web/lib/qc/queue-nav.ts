import type { SurveyRow } from "@/components/surveys/survey-tables"

function isSurveyPendingQc(row: Pick<SurveyRow, "qcStatus" | "status">): boolean {
  return row.qcStatus === "pending" && row.status === "submitted"
}

/** Next pending survey in ward queue after the current one (list is pre-sorted by property ID). */
function comparePropertyIds(a?: string, b?: string): number {
  const ka = (a ?? "").trim().toUpperCase()
  const kb = (b ?? "").trim().toUpperCase()
  if (!ka && !kb) return 0
  if (!ka) return 1
  if (!kb) return -1
  return ka.localeCompare(kb, undefined, { numeric: true })
}

export function findNextPendingSurvey(
  rows: SurveyRow[],
  current: Pick<SurveyRow, "_id" | "propertyId"> | null | undefined
): SurveyRow | undefined {
  const pending = rows.filter(isSurveyPendingQc)
  if (pending.length === 0) return undefined
  if (!current) return pending[0]

  const idx = pending.findIndex((r) => r._id === current._id)
  if (idx >= 0) return pending[idx + 1]

  // When viewing a non-pending survey (approved/rejected), we still want "next in queue"
  // by queue position. Approximate that by comparing property IDs against the sorted pending list.
  const currentPropertyId = current.propertyId
  if (!currentPropertyId) return pending[0]

  for (const row of pending) {
    if (comparePropertyIds(row.propertyId, currentPropertyId) > 0) return row
  }

  return undefined
}

function countPendingQc(rows: SurveyRow[]): number {
  return rows.filter(isSurveyPendingQc).length
}
