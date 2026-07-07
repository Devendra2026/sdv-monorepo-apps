import type { MasterOption } from "@/convex/areaMasters";
import { PROPERTY_USE_CODES } from "@/convex/propertyId";
import { padUnitNo, propertyUseCode } from "@/lib/survey/area";
import { labelFromOptions } from "@/lib/survey/detail-labels";
import { formatRegistryParcelNo } from "@/lib/survey/format-registry-parcel";

export type RegistrySlotSource = {
  parcelNo?: string;
  unitNo?: string;
  propertyUse?: string;
  propertyId?: string;
};

/** Human label for property use with optional letter suffix, e.g. "Commercial (C)". */
export function formatPropertyUseLabel(propertyUse: string | undefined, propertyUses?: MasterOption[]): string {
  if (!propertyUse?.trim()) return "—";
  const label = labelFromOptions(propertyUses, propertyUse);
  const letter = propertyUseCode(propertyUse);
  if (letter && label !== propertyUse) {
    return `${label} (${letter})`;
  }
  if (letter) return `${label} (${letter})`;
  return label;
}

/** Extract use letter from stored Property ID suffix when present. */
function useLetterFromPropertyId(propertyId?: string): string | undefined {
  const id = propertyId?.trim().toUpperCase();
  if (!id) return undefined;
  const parts = id.split("-");
  const last = parts[parts.length - 1];
  if (last && last.length === 1 && /[A-Z]/.test(last)) return last;
  return undefined;
}

/** Registry slot line: Parcel · Unit · Use — distinguishes rows on the same parcel number. */
export function formatRegistrySlotLabel(row: RegistrySlotSource, propertyUses?: MasterOption[]): string {
  const parcel = formatRegistryParcelNo(row.parcelNo);
  const unit = row.unitNo?.trim() ? padUnitNo(row.unitNo) || row.unitNo : "—";
  const useLabel = formatPropertyUseLabel(row.propertyUse, propertyUses);
  if (parcel === "—") return useLabel;
  return `Parcel ${parcel} · Unit ${unit} · ${useLabel}`;
}

/** Reverse map: letter → master value key (for tooltip copy). */
const PROPERTY_USE_LETTER_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(PROPERTY_USE_CODES).map(([k, v]) => [v, k.replace(/_/g, " ")]),
);
