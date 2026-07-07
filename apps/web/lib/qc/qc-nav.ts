/** Build QC review URL with optional scope query params for registry continuity. */
export function buildNextQcHref(
  nextId: string,
  scope: { wardNo?: string; municipalityId?: string; districtId?: string },
): string {
  const params = new URLSearchParams();
  if (scope.wardNo) params.set("wardNo", scope.wardNo);
  if (scope.municipalityId) params.set("municipalityId", scope.municipalityId);
  if (scope.districtId) params.set("districtId", scope.districtId);
  const qs = params.toString();
  return qs ? `/qc/${nextId}?${qs}` : `/qc/${nextId}`;
}
