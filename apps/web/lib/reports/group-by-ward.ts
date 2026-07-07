import { normalizeWardNo, wardGroupKey } from "@/lib/qc/ward-stats";
import type { SurveyListItem } from "@/schema/surveys/index";

export type WardGroupedRow<T> = {
  wardNo: string;
  wardLabel?: string;
  municipalityId?: string;
  city: string;
  items: T[];
};

export function groupSurveysByWard(
  rows: SurveyListItem[],
  wardLabels?: Map<string, string>,
): WardGroupedRow<SurveyListItem>[] {
  const byKey = new Map<string, WardGroupedRow<SurveyListItem>>();

  for (const row of rows) {
    if (!row.wardNo?.trim()) continue;
    const key = wardGroupKey(row);
    let entry = byKey.get(key);
    if (!entry) {
      const normalizedWard = normalizeWardNo(row.wardNo);
      entry = {
        wardNo: normalizedWard,
        wardLabel:
          wardLabels?.get(row.wardNo) ??
          wardLabels?.get(normalizedWard) ??
          wardLabels?.get(row.wardNo.padStart(2, "0")),
        municipalityId: row.municipalityId,
        city: row.city ?? "",
        items: [],
      };
      byKey.set(key, entry);
    }
    entry.items.push(row);
  }

  for (const entry of byKey.values()) {
    entry.items.sort((a, b) => (a.parcelNo ?? "").localeCompare(b.parcelNo ?? "", undefined, { numeric: true }));
  }

  return Array.from(byKey.values()).toSorted((a, b) => a.wardNo.localeCompare(b.wardNo, undefined, { numeric: true }));
}

export function formatWardTitle(wardNo: string, wardLabel?: string): string {
  const n = Number.parseInt(wardNo, 10);
  const label = Number.isNaN(n) ? wardNo : String(n).padStart(2, "0");
  return wardLabel ? `Ward ${label} — ${wardLabel}` : `Ward ${label}`;
}
