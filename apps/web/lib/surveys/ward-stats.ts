import type { QcStatus, SurveyStatus } from "@/lib/domain";

export type SurveyWardSourceRow = {
  _id: string;
  municipalityId?: string;
  wardNo: string;
  city: string;
  status: SurveyStatus;
  qcStatus: QcStatus;
  surveyorName?: string;
};

export type SurveyWardRow = {
  wardNo: string;
  wardLabel?: string;
  municipalityId?: string;
  city: string;
  total: number;
  drafts: number;
  submitted: number;
  qcApproved: number;
  activeSurveyorCount: number;
  activeSurveyorNames: string[];
};

export function normalizeWardNo(wardNo: string): string {
  const n = Number.parseInt(wardNo, 10);
  return Number.isNaN(n) ? wardNo : String(n);
}

function wardGroupKey(row: Pick<SurveyWardSourceRow, "municipalityId" | "wardNo">): string {
  return `${row.municipalityId ?? ""}:${normalizeWardNo(row.wardNo)}`;
}

function resolveWardLabel(wardNo: string, wardLabels?: Map<string, string>): string | undefined {
  if (!wardLabels) return undefined;
  return wardLabels.get(wardNo) ?? wardLabels.get(normalizeWardNo(wardNo)) ?? wardLabels.get(wardNo.padStart(2, "0"));
}

export function computeSurveyWardStats(rows: SurveyWardSourceRow[], wardLabels?: Map<string, string>): SurveyWardRow[] {
  const byKey = new Map<string, SurveyWardRow>();
  const surveyorsByKey = new Map<string, Set<string>>();

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
        total: 0,
        drafts: 0,
        submitted: 0,
        qcApproved: 0,
        activeSurveyorCount: 0,
        activeSurveyorNames: [],
      };
      byKey.set(key, entry);
      surveyorsByKey.set(key, new Set());
    }

    entry.total += 1;
    if (row.status === "draft") entry.drafts += 1;
    if (row.status === "submitted") entry.submitted += 1;
    if (row.qcStatus === "approved") entry.qcApproved += 1;

    if ((row.status === "draft" || row.status === "submitted") && row.surveyorName) {
      surveyorsByKey.get(key)!.add(row.surveyorName);
    }
  }

  for (const entry of byKey.values()) {
    const key = `${entry.municipalityId ?? ""}:${entry.wardNo}`;
    const names = [...(surveyorsByKey.get(key) ?? [])];
    entry.activeSurveyorNames = names;
    entry.activeSurveyorCount = names.length;
  }

  return Array.from(byKey.values()).toSorted((a, b) => a.wardNo.localeCompare(b.wardNo, undefined, { numeric: true }));
}

export function enrichServerSurveyWardStats(
  rows: Array<{
    wardNo: string;
    municipalityId: string;
    city: string;
    total: number;
    drafts: number;
    submitted: number;
    qcApproved: number;
    activeSurveyorCount: number;
    activeSurveyorNames: string[];
  }>,
  wardLabels?: Map<string, string>,
): SurveyWardRow[] {
  return rows.map((row) => ({
    ...row,
    wardLabel: resolveWardLabel(row.wardNo, wardLabels),
  }));
}
