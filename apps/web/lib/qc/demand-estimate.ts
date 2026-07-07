/** Illustrative annual demand breakdown for QC final report display. */
export type DemandLine = { label: string; amount: number };

export type DemandAssessment = {
  lines: DemandLine[];
  total: number;
};

const ZONE_RATE_PER_SQFT: Record<string, number> = {
  below_9m: 1.24,
  "9_to_12m": 1.05,
  "12_to_24m": 0.9,
  above_24m: 0.75,
  rate_zone_1: 1.24,
  rate_zone_2: 1.05,
  rate_zone_3: 0.9,
  rate_zone_4: 0.75,
  rate_zone_5: 0.65,
};

export function estimateDemandAssessment(
  survey: {
    taxRateZone?: string;
    municipalWaterConnection?: boolean;
    sanitationType?: string;
  },
  builtUpSqft: number,
): DemandAssessment {
  if (!(builtUpSqft > 0)) {
    return { lines: [], total: 0 };
  }

  const rate = ZONE_RATE_PER_SQFT[survey.taxRateZone ?? ""] ?? 2.5;
  const propertyTax = Math.round(builtUpSqft * rate);
  const educationCess = Math.round(propertyTax * 0.15);
  const waterFee = survey.municipalWaterConnection ? 1500 : 0;
  const drainage = survey.sanitationType ? 800 : 400;

  return {
    lines: [
      { label: "Property Tax", amount: propertyTax },
      { label: "Education Cess", amount: educationCess },
      { label: "Water Connection Fee", amount: waterFee },
      { label: "Drainage Maintenance", amount: drainage },
    ],
    total: propertyTax + educationCess + waterFee + drainage,
  };
}

export function formatInr(amount: number): string {
  return `₹ ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
