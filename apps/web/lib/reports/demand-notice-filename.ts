function slugifyFilenamePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function buildBulkDemandNoticeFilename(parts: { ulbName?: string; wardNo?: string; dateIso?: string }): string {
  const date = parts.dateIso ?? new Date().toISOString().slice(0, 10);
  const ulb = parts.ulbName ? slugifyFilenamePart(parts.ulbName) : "ulb";
  const ward = parts.wardNo ? `ward-${slugifyFilenamePart(parts.wardNo)}` : "all-wards";
  return `demand_notices_${ulb}_${ward}_${date}.pdf`;
}
