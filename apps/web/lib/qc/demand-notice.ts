import type { MasterOption } from "@/convex/areaMasters";
import {
  annualRateToMonthly,
  DEFAULT_RATE_MATRIX,
  DEFAULT_TAX_RATES,
  TAX_RATE_ZONE_ROWS,
} from "@/lib/qc/tax-rate-defaults";
import {
  hasWardCustomRates,
  resolveAnnualRate,
  resolveConstructionTypeKey,
  resolveTaxRateZoneKey,
} from "@/lib/qc/tax-rate-matrix";
import { isOpenLandOnlyProperty } from "@/lib/survey/area";
import { labelFromOptions } from "@/lib/survey/detail-labels";
import type { FloorRow, SurveyDetail } from "@/schema/surveys/index";
import { formatInr } from "./demand-estimate";
import { computeFloorPropertyTax, computeTotalAnnualDemand } from "./property-tax-calc";

export type FloorAssessmentRow = {
  floorLabel: string;
  usageTypeLabel: string;
  usageFactorLabel: string;
  constructionLabel: string;
  areaSqft: number;
  monthlyRate: number;
  baseRate: number;
  roadFactor: number;
  usageMult: number;
  alv: number;
  assessableAlv: number;
  tax: number;
};

/** Annual rate resolved from ward matrix + road-width zone + construction (master data). */
export type MasterBaseRate = {
  wardNo: string;
  zoneKey: string;
  zoneLabel: string;
  constructionKey: string;
  constructionLabel: string;
  monthlyRate: number;
  annualRate: number;
};

export type DemandNoticeData = {
  floorRows: FloorAssessmentRow[];
  masterBaseRate: MasterBaseRate | null;
  roadTypeFactor: number;
  rateSource: "ward" | "ulb" | "system";
  totalArea: number;
  totalAlv: number;
  totalAssessableAlv: number;
  assessableValuePct: number;
  totalTax: number;
  propertyTax: number;
  waterTax: number;
  drainageTax: number;
  totalAnnualDemand: number;
};

/** Dynamic rate config from the taxRates table; null means use system defaults. */
export type TaxRateConfig = {
  rateMatrix: Record<string, Record<string, number>>;
  wardRates?: Record<string, Record<string, Record<string, number>>>;
  propertyTaxPct: number;
  waterTaxPct: number;
  drainageTaxPct: number;
  usageMultipliers: Record<string, number>;
} | null;

/** Residential ×1; commercial/shop doubles the panel rate (×2). */
function resolveUsageRateMult(usageFactor: string, usageType: string, propertyUse?: string): number {
  const key = (usageFactor || usageType || propertyUse || "").toLowerCase();
  if (key.includes("commercial") || key.includes("shop")) return 2;
  return 1;
}

export function buildSurveyAddress(survey: SurveyDetail): string {
  return [survey.houseNo, survey.colonyName, survey.locality, survey.city, survey.pinCode].filter(Boolean).join(", ");
}

/** e.g. "Sukhwasi w/o Ram Kishan" when father name is present. */
function formatOwnerDisplay(ownerName: string, fatherName?: string): string {
  const name = ownerName.trim();
  const father = fatherName?.trim();
  if (!name || name === "—") return "—";
  if (!father || father === "—") return name;
  return `${name} w/o ${father}`;
}

const DEMAND_NOTICE_SHORT_LEGAL = {
  english:
    "Any objection to this assessment must be submitted in writing to the Executive Officer within 15 days from the date of this notice. Failure to do so will result in the demand being considered final and recoverable as arrears.",
  hindi:
    "इस मूल्यांकन पर कोई भी आपत्ति इस नोटिस की तिथि से 15 दिनों के भीतर कार्यकारी अधिकारी को लिखित रूप में प्रस्तुत की जानी चाहिए। ऐसा न करने पर मांग को अंतिम मानकर बकाया के रूप में वसूली जाएगी।",
} as const;

const BODY_TYPE_LABELS: Record<string, { hindi: string; english: string }> = {
  municipal_council: {
    hindi: "नगर पालिका परिषद",
    english: "Nagar Palika Parishad",
  },
  town_panchayat: {
    hindi: "नगर पंचायत",
    english: "Town Panchayat",
  },
};

export type OfficeTitles = {
  hindi: string;
  english: string;
  /** Primary header line, e.g. "Office of Town Panchayat Aminagar Sarai". */
  headerLine1: string;
  /** Secondary header line, e.g. "Baghpat, Uttar Pradesh". */
  headerLine2: string;
  ulbName: string;
  districtName: string;
  stateName: string;
};

/** Avoid "Office of Town Panchayat Town Panchayat …" when the ULB name already includes the body type. */
function officeSubjectName(cityName: string, bodyLabel: string): string {
  const city = cityName.trim();
  const body = bodyLabel.trim();
  if (!body) return city;
  if (city.toLowerCase().startsWith(body.toLowerCase())) return city;
  return `${body} ${city}`;
}

export function buildOfficeTitles(
  cityName: string,
  stateName: string,
  bodyType?: string,
  districtName?: string,
): OfficeTitles {
  const body = BODY_TYPE_LABELS[bodyType ?? "municipal_council"] ?? BODY_TYPE_LABELS.municipal_council!;
  const district = districtName?.trim() || "—";
  const subject = officeSubjectName(cityName, body.english);
  const headerLine1 = `Office of ${subject}`;
  const headerLine2 = district !== "—" ? `${district}, ${stateName}` : stateName;
  return {
    hindi: `कार्यालय ${officeSubjectName(cityName, body.hindi)}`,
    english: headerLine1,
    headerLine1,
    headerLine2,
    ulbName: cityName,
    districtName: district,
    stateName,
  };
}

export function computeDemandNotice(
  survey: SurveyDetail,
  floors: FloorRow[],
  masters?: {
    floors?: MasterOption[];
    usageTypes?: MasterOption[];
    usageFactors?: MasterOption[];
    constructionTypes?: MasterOption[];
    taxRateZones?: MasterOption[];
  },
  rateConfig?: TaxRateConfig,
): DemandNoticeData {
  const fallbackMatrix = rateConfig?.rateMatrix ?? DEFAULT_RATE_MATRIX;
  const usesWardRates = hasWardCustomRates(survey.wardNo, rateConfig?.wardRates);
  const rateSource: DemandNoticeData["rateSource"] = usesWardRates ? "ward" : rateConfig ? "ulb" : "system";

  const assessableValuePct = DEFAULT_TAX_RATES.assessableValuePct;
  const propertyTaxRate = rateConfig?.propertyTaxPct ?? DEFAULT_TAX_RATES.propertyTaxPct;
  const waterTaxRate = rateConfig?.waterTaxPct ?? DEFAULT_TAX_RATES.waterTaxPct;
  const drainageTaxRate = rateConfig?.drainageTaxPct ?? DEFAULT_TAX_RATES.drainageTaxPct;

  const primaryFloor = floors[0];
  const primaryConstruction = primaryFloor?.constructionType ?? "pakka_rcc_rb";
  const zoneKey = resolveTaxRateZoneKey(survey.taxRateZone);
  const constructionKey = resolveConstructionTypeKey(primaryConstruction);
  const annualBaseRate = resolveAnnualRate(
    survey.wardNo,
    survey.taxRateZone,
    primaryConstruction,
    rateConfig?.wardRates,
    fallbackMatrix,
  );
  const zoneLabel =
    labelFromOptions(masters?.taxRateZones, survey.taxRateZone) ??
    TAX_RATE_ZONE_ROWS.find((z) => z.key === zoneKey)?.label ??
    zoneKey;
  const constructionLabel =
    labelFromOptions(masters?.constructionTypes, primaryConstruction) ??
    labelFromOptions(masters?.constructionTypes, constructionKey) ??
    constructionKey;

  const masterBaseRate: MasterBaseRate | null =
    floors.length > 0
      ? {
          wardNo: survey.wardNo,
          zoneKey,
          zoneLabel,
          constructionKey,
          constructionLabel,
          monthlyRate: annualRateToMonthly(annualBaseRate),
          annualRate: annualBaseRate,
        }
      : null;

  const floorRows: FloorAssessmentRow[] = floors.map((floor) => {
    const area = floor.areaSqft ?? 0;
    const annualBaseRate = resolveAnnualRate(
      survey.wardNo,
      survey.taxRateZone,
      floor.constructionType,
      rateConfig?.wardRates,
      fallbackMatrix,
    );
    const panelRate = annualRateToMonthly(annualBaseRate);
    const usageMult = resolveUsageRateMult(floor.usageFactor ?? "", floor.usageType, survey.propertyUse);
    const { monthlyRate, alv, assessableAlv, tax } = computeFloorPropertyTax(
      area,
      panelRate,
      propertyTaxRate,
      usageMult,
      assessableValuePct,
    );
    return {
      floorLabel: labelFromOptions(masters?.floors, floor.floorName) || floor.floorName || "—",
      usageTypeLabel: labelFromOptions(masters?.usageTypes, floor.usageType) || floor.usageType || "—",
      usageFactorLabel: labelFromOptions(masters?.usageFactors, floor.usageFactor) || floor.usageFactor || "—",
      constructionLabel: labelFromOptions(masters?.constructionTypes, floor.constructionType) || "—",
      areaSqft: area,
      monthlyRate,
      baseRate: annualBaseRate,
      roadFactor: 1,
      usageMult,
      alv,
      assessableAlv,
      tax,
    };
  });

  const totalArea = floorRows.reduce((s, r) => s + r.areaSqft, 0);
  const totalAlv = floorRows.reduce((s, r) => s + r.alv, 0);
  const totalAssessableAlv = floorRows.reduce((s, r) => s + r.assessableAlv, 0);
  const totalTax = floorRows.reduce((s, r) => s + r.tax, 0);
  const propertyTax = totalTax;
  const openLandOnly = isOpenLandOnlyProperty(survey.propertyUse, floors);
  const includeServiceTaxes = !openLandOnly;
  const { waterTax, drainageTax, totalAnnualDemand } = computeTotalAnnualDemand(
    totalAssessableAlv,
    propertyTax,
    waterTaxRate,
    drainageTaxRate,
    includeServiceTaxes && Boolean(survey.municipalWaterConnection),
    includeServiceTaxes,
  );

  return {
    floorRows,
    masterBaseRate,
    roadTypeFactor: 1,
    rateSource,
    totalArea,
    totalAlv,
    totalAssessableAlv,
    assessableValuePct,
    totalTax,
    propertyTax,
    waterTax,
    drainageTax,
    totalAnnualDemand,
  };
}

export function formatNoticeDate(ms?: number | null): string {
  const date = ms ? new Date(ms) : new Date();
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

export function formatAmountPlain(amount: number): string {
  return amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Official municipal demand-notice legal text (UP Nagar Palika Act / self-assessment rules). */
export const DEMAND_NOTICE_LEGAL_COPY = {
  hindi: `कृपया नोटिस प्राप्ति के 15 दिवस के अन्दर यदि कोई आपत्ति हो तो पालिका में दाखिल करें। अन्यथा की स्थिति में आपकी स्वीकृती मानते हुए उक्त मूल्यांकित दर प्रभावी कर दी जायेगी। वाद मियाद डिमांड कायम करते हुए नगर पालिका अधिनियम 1916 की धारा 141 क 2 के अनुसार शास्ति निर्धारण करते हुए बिल मांग प्रेषित की जायेगी एवं अधिनियम 1916 की धारा 144 एवं भूमि/भवन स्वकर निर्धारण नियमावली 2024 के अन्तर्गत वसूली की जायेगी एवं निर्धारण अवधि में कर जमा करने पर सम्पत्ति कर में छूट एवं निर्धारण अवधि में कर जमा न करने पर ब्याज सहित वसूला जाएगा।`,
  hindiNote: `नोट:- उक्त कर निर्धारण वाद प्रक्रिया हेतु मान्य नहीं होगा एवं कोई भी भवन स्वामी का उक्त प्रक्रिया एवं कर रसीद के स्वामित्व का दावा मान्य नहीं होगा। यदि पूर्व में गृह कर की धन राशि बकाया है तो वह मांग के अनुसार देय होगी।`,
  english: `Please file any objection with the municipality within 15 days of receipt of this notice. Otherwise, your consent shall be deemed given and the assessed rate shall be made effective. Demand shall be raised as time-barred demand and a bill shall be issued with penalty under Section 141(2) of the Uttar Pradesh Municipalities Act, 1916, and recovery shall be made under Section 144 of the said Act and the Land/Building Self-Tax Assessment Rules, 2024. Rebate on property tax shall apply for payment within the assessment period; otherwise amount shall be recovered with interest.`,
  englishNote: `Note: This tax assessment shall not be valid for litigation proceedings, and no building owner may claim ownership based on this process or tax receipt. Any prior house-tax arrears shall remain payable as per demand.`,
} as const;

export { formatInr };
