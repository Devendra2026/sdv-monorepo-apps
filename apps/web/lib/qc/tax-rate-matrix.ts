import {
  annualRateToMonthly,
  DEFAULT_RATE_MATRIX,
  monthlyRateToAnnual,
  TAX_RATE_CONSTRUCTION_COLS,
  TAX_RATE_ZONE_ROWS,
} from "./tax-rate-defaults";

export type RateMatrixAnnual = Record<string, Record<string, number>>;
export type RateMatrixMonthlyForm = Record<string, Record<string, string>>;
export type WardRatesAnnual = Record<string, RateMatrixAnnual>;

/** Legacy survey / master keys → canonical zone keys used in rate matrices. */
const TAX_ZONE_ALIASES: Record<string, string> = {
  rate_zone_1: "below_9m",
  rate_zone_2: "9_to_12m",
  rate_zone_3: "12_to_24m",
  rate_zone_4: "above_24m",
  rate_zone_5: "above_24m",
};

export function f2(n: number) {
  return n.toFixed(2);
}

function normalizeWardNo(wardNo: string): string {
  const trimmed = wardNo.trim();
  const stripped = trimmed.replace(/^0+/, "");
  return stripped.length > 0 ? stripped : "0";
}

/** Ward keys that may exist in stored wardRates (01 vs 1). */
function wardLookupKeys(wardNo: string): string[] {
  const trimmed = wardNo.trim();
  const normalized = normalizeWardNo(trimmed);
  const keys = new Set<string>([trimmed, normalized]);
  if (/^\d+$/.test(normalized)) {
    keys.add(normalized.padStart(2, "0"));
  }
  return [...keys];
}

export function resolveTaxRateZoneKey(zone?: string): string {
  if (!zone) return "below_9m";
  const key = zone.trim().toLowerCase();
  return TAX_ZONE_ALIASES[key] ?? key;
}

const CONSTRUCTION_ALIASES: Record<string, string> = {
  rcc: "pakka_rcc_rb",
  pakka: "pakka_rcc_rb",
  pakka_building: "pakka_rcc_rb",
  rb_roof: "pakka_rcc_rb",
  tin: "tin_shed",
  kaccha: "kaccha_building",
  open_land: "open_land_plot",
};

export function resolveConstructionTypeKey(constructionType: string): string {
  const key = constructionType.trim().toLowerCase();
  return CONSTRUCTION_ALIASES[key] ?? key;
}

export function annualMatrixToMonthlyForm(matrix: RateMatrixAnnual): RateMatrixMonthlyForm {
  const form: RateMatrixMonthlyForm = {};
  for (const z of TAX_RATE_ZONE_ROWS) {
    form[z.key] = {};
    for (const c of TAX_RATE_CONSTRUCTION_COLS) {
      const annual = matrix[z.key]?.[c.key] ?? DEFAULT_RATE_MATRIX[z.key]?.[c.key] ?? 4;
      form[z.key][c.key] = f2(annualRateToMonthly(annual));
    }
  }
  return form;
}

export function monthlyFormToAnnualMatrix(form: RateMatrixMonthlyForm): RateMatrixAnnual {
  const matrix: RateMatrixAnnual = {};
  for (const z of TAX_RATE_ZONE_ROWS) {
    matrix[z.key] = {};
    for (const c of TAX_RATE_CONSTRUCTION_COLS) {
      const monthly = parseFloat(form[z.key]?.[c.key] || "0");
      matrix[z.key][c.key] = monthlyRateToAnnual(monthly);
    }
  }
  return matrix;
}

export function buildDefaultMonthlyMatrix(): RateMatrixMonthlyForm {
  return annualMatrixToMonthlyForm(DEFAULT_RATE_MATRIX);
}

export function cloneMonthlyMatrix(matrix: RateMatrixMonthlyForm): RateMatrixMonthlyForm {
  const copy: RateMatrixMonthlyForm = {};
  for (const z of TAX_RATE_ZONE_ROWS) {
    copy[z.key] = { ...matrix[z.key] };
  }
  return copy;
}

export function matricesEqual(a: RateMatrixMonthlyForm, b: RateMatrixMonthlyForm): boolean {
  for (const z of TAX_RATE_ZONE_ROWS) {
    for (const c of TAX_RATE_CONSTRUCTION_COLS) {
      if ((a[z.key]?.[c.key] ?? "") !== (b[z.key]?.[c.key] ?? "")) return false;
    }
  }
  return true;
}

export function hasWardCustomRates(wardNo: string, wardRates?: WardRatesAnnual | null): boolean {
  if (!wardRates) return false;
  return wardLookupKeys(wardNo).some((key) => wardRates[key] !== undefined);
}

export function resolveWardRateMatrix(
  wardNo: string,
  wardRates?: WardRatesAnnual | null,
  fallbackMatrix?: RateMatrixAnnual | null,
): RateMatrixAnnual {
  if (wardRates) {
    for (const key of wardLookupKeys(wardNo)) {
      const matrix = wardRates[key];
      if (matrix) return matrix;
    }
  }
  return fallbackMatrix ?? DEFAULT_RATE_MATRIX;
}

export function resolveAnnualRate(
  wardNo: string,
  taxRateZone: string | undefined,
  constructionType: string,
  wardRates?: WardRatesAnnual | null,
  fallbackMatrix?: RateMatrixAnnual | null,
): number {
  const matrix = resolveWardRateMatrix(wardNo, wardRates, fallbackMatrix);
  const zone = resolveTaxRateZoneKey(taxRateZone);
  const constr = resolveConstructionTypeKey(constructionType);
  const zoneRow = matrix[zone] ?? matrix.below_9m ?? {};
  return zoneRow[constr] ?? zoneRow[constructionType] ?? zoneRow.pakka_rcc_rb ?? 4;
}
