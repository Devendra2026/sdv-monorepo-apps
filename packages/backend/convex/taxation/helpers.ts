import { v } from "convex/values"
import { DEFAULT_RATE_MATRIX, DEFAULT_TAX_RATES, DEFAULT_USAGE_MULTIPLIERS } from "../lib/qc/taxRateDefaults"

export { DEFAULT_RATE_MATRIX, DEFAULT_TAX_RATES, DEFAULT_USAGE_MULTIPLIERS }

export const rateMatrixValidator = v.record(v.string(), v.record(v.string(), v.number()))

export const normalizedTaxRatesValidator = v.object({
  rateMatrix: rateMatrixValidator,
  wardRates: v.record(v.string(), rateMatrixValidator),
  propertyTaxPct: v.number(),
  waterTaxPct: v.number(),
  drainageTaxPct: v.number(),
  usageMultipliers: v.record(v.string(), v.number()),
})
