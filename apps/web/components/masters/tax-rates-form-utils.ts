import type { RateForm, WardInfo } from "@/components/masters/tax-rates-types";
import type { NormalizedTaxRates } from "@/lib/qc/normalize-tax-rates";
import { DEFAULT_TAX_RATES, DEFAULT_USAGE_MULTIPLIERS } from "@/lib/qc/tax-rate-defaults";
import {
  annualMatrixToMonthlyForm,
  buildDefaultMonthlyMatrix,
  f2,
  monthlyFormToAnnualMatrix,
  resolveWardRateMatrix,
  type RateMatrixMonthlyForm,
} from "@/lib/qc/tax-rate-matrix";

const USAGE_ROWS = [
  { key: "residential", label: "Residential" },
  { key: "commercial", label: "Commercial" },
  { key: "mix", label: "Mixed Use" },
  { key: "open_land", label: "Open Land" },
  { key: "open_land_under_construction", label: "Under Construction" },
  { key: "religious_property", label: "Religious" },
  { key: "godown", label: "Godown" },
  { key: "agriculture", label: "Agriculture" },
] as const;

export function pctToDecimal(s: string) {
  return parseFloat(s) / 100;
}

export function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

export function buildWardForm(wards: WardInfo[], existing: NormalizedTaxRates | null): RateForm {
  const defaultMatrix = existing ? annualMatrixToMonthlyForm(existing.rateMatrix) : buildDefaultMonthlyMatrix();

  const wardMatrices: Record<string, RateMatrixMonthlyForm> = {};
  for (const ward of wards) {
    const annual = resolveWardRateMatrix(ward.wardNo, existing?.wardRates, existing?.rateMatrix ?? null);
    wardMatrices[ward.wardNo] = annualMatrixToMonthlyForm(annual);
  }

  return {
    defaultMatrix,
    wardMatrices,
    propertyTaxPct: f2((existing?.propertyTaxPct ?? DEFAULT_TAX_RATES.propertyTaxPct) * 100),
    waterTaxPct: f2((existing?.waterTaxPct ?? DEFAULT_TAX_RATES.waterTaxPct) * 100),
    drainageTaxPct: f2((existing?.drainageTaxPct ?? DEFAULT_TAX_RATES.drainageTaxPct) * 100),
    usageMultipliers: Object.fromEntries(
      USAGE_ROWS.map((u) => [u.key, f2(existing?.usageMultipliers?.[u.key] ?? DEFAULT_USAGE_MULTIPLIERS[u.key] ?? 1)]),
    ),
  };
}

export function ulbSettingsFromForm(form: RateForm) {
  return {
    propertyTaxPct: pctToDecimal(form.propertyTaxPct),
    waterTaxPct: pctToDecimal(form.waterTaxPct),
    drainageTaxPct: pctToDecimal(form.drainageTaxPct),
    usageMultipliers: Object.fromEntries(
      USAGE_ROWS.map((u) => [u.key, parseFloat(form.usageMultipliers[u.key] || "1")]),
    ),
  };
}

export function formToPayload(form: RateForm, wards: WardInfo[]) {
  const wardRates: Record<string, ReturnType<typeof monthlyFormToAnnualMatrix>> = {};
  for (const ward of wards) {
    const matrix = form.wardMatrices[ward.wardNo];
    if (matrix) wardRates[ward.wardNo] = monthlyFormToAnnualMatrix(matrix);
  }
  return {
    rateMatrix: monthlyFormToAnnualMatrix(form.defaultMatrix),
    wardRates,
    ...ulbSettingsFromForm(form),
  };
}
