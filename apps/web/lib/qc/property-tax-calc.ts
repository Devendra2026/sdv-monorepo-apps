import { DEFAULT_TAX_RATES } from "./tax-rate-defaults";

/** Round to 2 decimal places (paise). */
function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Gross annual letting value from tax-rate panel value.
 *   Gross ALV = area (sqft) × panel rate × 12 × usage multiplier
 */
export function computeGrossAlvFromPanelRate(areaSqft: number, panelRate: number, usageMult = 1): number {
  return roundMoney(areaSqft * panelRate * 12 * usageMult);
}

/**
 * @deprecated Prefer `computeGrossAlvFromPanelRate` with panel rate. Equivalent when yearlyRate = panelRate × 12.
 */
function computeGrossAlvYearly(areaSqft: number, yearlyRatePerSqft: number, usageMult = 1): number {
  return roundMoney(areaSqft * yearlyRatePerSqft * usageMult);
}

/** Assessable value (yearly): 80% of gross annual ALV. */
function computeAssessableAlv(grossAlv: number, assessableValuePct = DEFAULT_TAX_RATES.assessableValuePct): number {
  return roundMoney(grossAlv * assessableValuePct);
}

/**
 * Tax component from ALV using "per hundred" rate.
 *   Tax = ALV / 100 × taxPerHundred
 */
function computeTaxFromAlv(alv: number, taxPct: number): number {
  const taxPerHundred = taxPct * 100;
  return roundMoney((alv / 100) * taxPerHundred);
}

/**
 * Property tax on assessable ALV (e.g. 10% of the 80% assessable base).
 */
function computePropertyTaxFromGrossAlv(
  grossAlv: number,
  propertyTaxPct: number,
  assessableValuePct = DEFAULT_TAX_RATES.assessableValuePct,
): { assessableAlv: number; propertyTax: number } {
  const assessableAlv = computeAssessableAlv(grossAlv, assessableValuePct);
  const propertyTax = computeTaxFromAlv(assessableAlv, propertyTaxPct);
  return { assessableAlv, propertyTax };
}

/**
 * Yearly assessable + Water + Drainage = Total demand (yearly).
 * Water and drainage are yearly % of total assessable ALV.
 */
export function computeTotalAnnualDemand(
  yearlyAssessableAlv: number,
  yearlyAssessableTax: number,
  waterTaxPct: number,
  drainageTaxPct: number,
  includeWater: boolean,
  includeDrainage = true,
): { waterTax: number; drainageTax: number; totalAnnualDemand: number } {
  const waterTax = includeWater ? computeTaxFromAlv(yearlyAssessableAlv, waterTaxPct) : 0;
  const drainageTax = includeDrainage ? computeTaxFromAlv(yearlyAssessableAlv, drainageTaxPct) : 0;
  const totalAnnualDemand = roundMoney(yearlyAssessableTax + waterTax + drainageTax);
  return { waterTax, drainageTax, totalAnnualDemand };
}

export function computeFloorPropertyTax(
  areaSqft: number,
  panelRate: number,
  propertyTaxPct: number,
  usageMult = 1,
  assessableValuePct = DEFAULT_TAX_RATES.assessableValuePct,
): { monthlyRate: number; alv: number; assessableAlv: number; tax: number } {
  const alv = computeGrossAlvFromPanelRate(areaSqft, panelRate, usageMult);
  const { assessableAlv, propertyTax } = computePropertyTaxFromGrossAlv(alv, propertyTaxPct, assessableValuePct);
  return { monthlyRate: panelRate, alv, assessableAlv, tax: propertyTax };
}
