import type { RateMatrixMonthlyForm } from "@/lib/qc/tax-rate-matrix";

export type WardInfo = { wardNo: string; name: string; wardCode: string };

export type RateForm = {
  defaultMatrix: RateMatrixMonthlyForm;
  wardMatrices: Record<string, RateMatrixMonthlyForm>;
  propertyTaxPct: string;
  waterTaxPct: string;
  drainageTaxPct: string;
  usageMultipliers: Record<string, string>;
};
