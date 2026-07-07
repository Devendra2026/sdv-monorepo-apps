import { formatPropertyId } from "@/lib/survey/area";

export type PropertyIdSource = {
  propertyId?: string;
  municipalityId?: string;
  wardNo?: string;
  parcelNo?: string;
  unitNo?: string;
  propertyUse?: string;
};

/** Computed Property ID from survey fields, falling back to stored value for incomplete drafts. */
export function resolveDisplayPropertyId(
  survey: PropertyIdSource,
  ulbCodeByMunicipalityId?: Map<string, string> | Record<string, string>,
): string | undefined {
  const muniId = survey.municipalityId;
  if (muniId) {
    const ulbCode =
      ulbCodeByMunicipalityId instanceof Map ? ulbCodeByMunicipalityId.get(muniId) : ulbCodeByMunicipalityId?.[muniId];
    if (ulbCode) {
      const computed = formatPropertyId({
        ulbCode,
        wardNo: survey.wardNo ?? "",
        parcelNo: survey.parcelNo ?? "",
        unitNo: survey.unitNo ?? "",
        propertyUse: survey.propertyUse ?? "",
      });
      if (computed) return computed;
    }
  }

  const stored = survey.propertyId?.trim();
  return stored ? stored.toUpperCase() : undefined;
}

export function buildUlbCodeMap(ulbs: { _id: string; code: string }[] | undefined): Map<string, string> {
  return new Map((ulbs ?? []).map((u) => [u._id, u.code]));
}
