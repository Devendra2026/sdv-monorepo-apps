/** System-default tax rates when no per-ULB row exists in `taxRates`. */

/**
 * 2D rate matrix: zone → construction_type → ₹ per sqft per year (annual ALV base rate).
 * Source: UP Nagar Palika Niyamavali 2024 — monthly rates × 12 for annual.
 *
 * Zones:    below_9m | 9_to_12m | 12_to_24m | above_24m
 * Constr:   pakka_rcc_rb | tin_shed | kaccha_building | open_land_plot | under_construction
 */
export const DEFAULT_RATE_MATRIX: Record<string, Record<string, number>> = {
  below_9m: {
    pakka_rcc_rb: 6.12, // 0.51 × 12
    tin_shed: 4.92, // 0.41 × 12
    kaccha_building: 3.72, // 0.31 × 12
    open_land_plot: 2.4, // 0.20 × 12
    under_construction: 2.4,
  },
  "9_to_12m": {
    pakka_rcc_rb: 5.16, // 0.43 × 12
    tin_shed: 4.08, // 0.34 × 12
    kaccha_building: 3.12, // 0.26 × 12
    open_land_plot: 2.04, // 0.17 × 12
    under_construction: 2.04,
  },
  "12_to_24m": {
    pakka_rcc_rb: 4.08, // 0.34 × 12
    tin_shed: 3.24, // 0.27 × 12
    kaccha_building: 2.4, // 0.20 × 12
    open_land_plot: 1.68, // 0.14 × 12
    under_construction: 1.68,
  },
  above_24m: {
    pakka_rcc_rb: 2.76, // 0.23 × 12
    tin_shed: 2.16, // 0.18 × 12
    kaccha_building: 1.68, // 0.14 × 12
    open_land_plot: 1.08, // 0.09 × 12
    under_construction: 1.08,
  },
  // Legacy zone key aliases
  rate_zone_1: {
    pakka_rcc_rb: 6.12,
    tin_shed: 4.92,
    kaccha_building: 3.72,
    open_land_plot: 2.4,
    under_construction: 2.4,
  },
  rate_zone_2: {
    pakka_rcc_rb: 5.16,
    tin_shed: 4.08,
    kaccha_building: 3.12,
    open_land_plot: 2.04,
    under_construction: 2.04,
  },
  rate_zone_3: {
    pakka_rcc_rb: 4.08,
    tin_shed: 3.24,
    kaccha_building: 2.4,
    open_land_plot: 1.68,
    under_construction: 1.68,
  },
  rate_zone_4: {
    pakka_rcc_rb: 2.76,
    tin_shed: 2.16,
    kaccha_building: 1.68,
    open_land_plot: 1.08,
    under_construction: 1.08,
  },
  rate_zone_5: {
    pakka_rcc_rb: 2.76,
    tin_shed: 2.16,
    kaccha_building: 1.68,
    open_land_plot: 1.08,
    under_construction: 1.08,
  },
};

/**
 * Road surface type multipliers — applied after the base matrix rate.
 * rcc (paved) = no adjustment; dambar/kaccha road = lower value location.
 */
const DEFAULT_ROAD_TYPE_FACTORS: Record<string, number> = {
  rcc: 1.0,
  dambar: 0.9,
  kaccha: 0.75,
};

export const DEFAULT_USAGE_MULTIPLIERS: Record<string, number> = {
  residential: 1.0,
  commercial: 1.45,
  mix_property: 1.2,
  mix: 1.2,
  open_land: 0.6,
  open_land_under_construction: 0.5,
  religious_property: 0.4,
  agriculture: 0.3,
  godown: 1.1,
};

export const DEFAULT_TAX_RATES = {
  /** Property tax is levied on this share of gross ALV (Baghpat: 80%). */
  assessableValuePct: 0.8,
  /** Rate on assessable ALV (e.g. 0.10 = 10%). */
  propertyTaxPct: 0.1,
  waterTaxPct: 0.075,
  drainageTaxPct: 0.025,
};

/** Fallback flat rate when zone+construction combo is not found in matrix. */
const FALLBACK_RATE = 4.0;

export function annualRateToMonthly(annual: number): number {
  return Math.round((annual / 12) * 100) / 100;
}

export function monthlyRateToAnnual(monthly: number): number {
  return Math.round(monthly * 12 * 100) / 100;
}

/** Road-width zones — widest road first (Baghpat circular order). */
export const TAX_RATE_ZONE_ROWS = [
  { key: "above_24m", label: "> 24 m", hint: "Highway / arterial road" },
  { key: "12_to_24m", label: "12 – 24 m", hint: "Main road" },
  { key: "9_to_12m", label: "9 – 12 m", hint: "Medium road" },
  { key: "below_9m", label: "≤ 9 m", hint: "Lane / gali" },
] as const;

/** Construction types per district rental-rate circular. */
export const TAX_RATE_CONSTRUCTION_COLS = [
  { key: "pakka_rcc_rb", label: "RCC / Pakka", hint: "RCC or R.B. roof" },
  { key: "tin_shed", label: "Other Pakka", hint: "Tin shed / semi-pakka" },
  { key: "kaccha_building", label: "Kachcha", hint: "Kachcha building" },
  { key: "open_land_plot", label: "Open Land", hint: "Vacant plot" },
] as const;

/** @deprecated Use DEFAULT_RATE_MATRIX instead. Kept for backward compat. */
const DEFAULT_ZONE_RATES: Record<string, number> = {
  below_9m: 6.12,
  "9_to_12m": 5.16,
  "12_to_24m": 4.08,
  above_24m: 2.76,
  rate_zone_1: 6.12,
  rate_zone_2: 5.16,
  rate_zone_3: 4.08,
  rate_zone_4: 2.76,
  rate_zone_5: 2.76,
};
