import { DEFAULT_RATE_MATRIX } from "./tax-rate-defaults";
import type { RateMatrixAnnual, WardRatesAnnual } from "./tax-rate-matrix";

export type StoredTaxRates = {
  rateMatrix?: RateMatrixAnnual;
  wardRates?: WardRatesAnnual;
  roadTypeFactors?: Record<string, number>;
  zoneRates?: Record<string, number>;
  propertyTaxPct: number;
  waterTaxPct: number;
  drainageTaxPct: number;
  usageMultipliers: Record<string, number>;
};

export type NormalizedTaxRates = {
  rateMatrix: RateMatrixAnnual;
  wardRates: WardRatesAnnual;
  propertyTaxPct: number;
  waterTaxPct: number;
  drainageTaxPct: number;
  usageMultipliers: Record<string, number>;
};

function scaleMatrixRow(zone: string, flatRate: number): Record<string, number> {
  const defaultRow = DEFAULT_RATE_MATRIX[zone] ?? DEFAULT_RATE_MATRIX.below_9m ?? {};
  const base = defaultRow.pakka_rcc_rb ?? 6.12;
  const scale = flatRate / base;
  return Object.fromEntries(
    Object.entries(defaultRow).map(([key, value]) => [key, Math.round(value * scale * 100) / 100]),
  );
}

function legacyZoneRatesToRateMatrix(zoneRates: Record<string, number>): RateMatrixAnnual {
  const matrix: RateMatrixAnnual = {};

  for (const [zone, rate] of Object.entries(zoneRates)) {
    matrix[zone] = scaleMatrixRow(zone, rate);
  }

  for (const zone of Object.keys(DEFAULT_RATE_MATRIX)) {
    if (!matrix[zone]) {
      matrix[zone] = { ...DEFAULT_RATE_MATRIX[zone]! };
    }
  }

  return matrix;
}

export function normalizeStoredTaxRates(doc: StoredTaxRates): NormalizedTaxRates {
  const rateMatrix = doc.rateMatrix
    ? doc.rateMatrix
    : doc.zoneRates
      ? legacyZoneRatesToRateMatrix(doc.zoneRates)
      : DEFAULT_RATE_MATRIX;

  return {
    rateMatrix,
    wardRates: doc.wardRates ?? {},
    propertyTaxPct: doc.propertyTaxPct,
    waterTaxPct: doc.waterTaxPct,
    drainageTaxPct: doc.drainageTaxPct,
    usageMultipliers: doc.usageMultipliers,
  };
}
