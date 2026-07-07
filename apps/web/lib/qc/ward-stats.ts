import type { SurveyRow } from "@/components/surveys/survey-tables";

export type QcWardRow = {
  wardNo: string;
  wardLabel?: string;
  municipalityId?: string;
  city: string;
  pending: number;
  approved: number;
  rejected: number;
  drafts: number;
  total: number;
  qcCompletionPct: number;
  firstPendingId?: string;
};

/** Normalize ward numbers so "01" and "1" aggregate together. */
export function normalizeWardNo(wardNo: string): string {
  const n = Number.parseInt(wardNo, 10);
  return Number.isNaN(n) ? wardNo : String(n);
}

export function wardGroupKey(row: Pick<SurveyRow, "municipalityId" | "wardNo">): string {
  return `${row.municipalityId ?? ""}:${normalizeWardNo(row.wardNo)}`;
}

function resolveWardLabel(wardNo: string, wardLabels?: Map<string, string>): string | undefined {
  if (!wardLabels) return undefined;
  return wardLabels.get(wardNo) ?? wardLabels.get(normalizeWardNo(wardNo)) ?? wardLabels.get(wardNo.padStart(2, "0"));
}

/** Aggregate QC and draft counts per ward within the current filter scope. */
export function computeQcWardStats(rows: SurveyRow[], wardLabels?: Map<string, string>): QcWardRow[] {
  const byKey = new Map<string, QcWardRow>();

  for (const row of rows) {
    if (!row.wardNo?.trim()) continue;

    const key = wardGroupKey(row);
    let entry = byKey.get(key);
    if (!entry) {
      const normalizedWard = normalizeWardNo(row.wardNo);
      entry = {
        wardNo: normalizedWard,
        wardLabel: resolveWardLabel(row.wardNo, wardLabels) ?? resolveWardLabel(normalizedWard, wardLabels),
        municipalityId: row.municipalityId,
        city: row.city,
        pending: 0,
        approved: 0,
        rejected: 0,
        drafts: 0,
        total: 0,
        qcCompletionPct: 0,
      };
      byKey.set(key, entry);
    }
    entry.total += 1;
    if (row.status === "draft") {
      entry.drafts += 1;
    }
    if (row.qcStatus === "pending" && row.status === "submitted") {
      entry.pending += 1;
      if (!entry.firstPendingId) entry.firstPendingId = row._id;
    }
    if (row.qcStatus === "approved") entry.approved += 1;
    if (row.qcStatus === "rejected") entry.rejected += 1;
  }

  for (const entry of byKey.values()) {
    const decided = entry.pending + entry.approved + entry.rejected;
    entry.qcCompletionPct = decided > 0 ? Math.round((entry.approved / decided) * 100) : 0;
  }

  return Array.from(byKey.values()).toSorted((a, b) => a.wardNo.localeCompare(b.wardNo, undefined, { numeric: true }));
}

/** Map server ward aggregates to client rows with master-data labels. */
export function enrichServerWardStats(
  rows: Array<{
    wardNo: string;
    municipalityId: string;
    city: string;
    pending: number;
    approved: number;
    rejected: number;
    drafts: number;
    total: number;
    qcCompletionPct: number;
    firstPendingId?: string;
  }>,
  wardLabels?: Map<string, string>,
): QcWardRow[] {
  return rows.map((row) => ({
    ...row,
    wardLabel: resolveWardLabel(row.wardNo, wardLabels),
  }));
}
