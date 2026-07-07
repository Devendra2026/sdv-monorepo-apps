import { padParcelNo, padWardNo } from "@/lib/survey/area";

/** Registry ward column — 3-digit padded (e.g. 5 → 005). */
export function formatRegistryWardNo(wardNo?: string): string {
  const raw = wardNo?.trim();
  if (!raw) return "—";
  return padWardNo(raw) || raw;
}

/** Registry parcel column — 5-digit padded (e.g. 1 → 00001). */
export function formatRegistryParcelNo(parcelNo?: string): string {
  const raw = parcelNo?.trim();
  if (!raw) return "—";
  return padParcelNo(raw) || raw;
}
