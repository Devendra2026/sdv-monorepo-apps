/** Collapse spacing and dash variants for stable alias lookup. */
function normalizeTaxZoneToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u2013\u2014-]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export function resolveTaxRateZoneKey(value?: string): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";

  const normalized = normalizeTaxZoneToken(trimmed);

  const aliases: Record<string, string> = {
    below_9m: "below_9m",
    below_9_meter: "below_9m",
    below_9_metre: "below_9m",
    "9_meter": "below_9m",
    "9_metre": "below_9m",
    "9_m": "below_9m",
    "9_to_12m": "9_to_12m",
    "9_to_12_meter": "9_to_12m",
    "9_to_12_metre": "9_to_12m",
    "9_12m": "9_to_12m",
    "9_12_meter": "9_to_12m",
    "9_12_metre": "9_to_12m",
    "12_to_24m": "12_to_24m",
    "12_to_24_meter": "12_to_24m",
    "12_to_24_metre": "12_to_24m",
    "12_24m": "12_to_24m",
    "12_24_meter": "12_to_24m",
    "12_24_metre": "12_to_24m",
    above_24m: "above_24m",
    above_24_meter: "above_24m",
    above_24_metre: "above_24m",
    "24_meter_above": "above_24m",
    "24_metre_above": "above_24m",
    "24m_above": "above_24m",
  };

  return aliases[normalized] ?? trimmed;
}
