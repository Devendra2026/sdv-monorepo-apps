import type { MasterOption } from "@/convex/areaMasters";
import { estimateDemandAssessment, type DemandAssessment } from "@/lib/qc/demand-estimate";
import { computeDemandNotice, type TaxRateConfig } from "@/lib/qc/demand-notice";
import { surveyAreaMetrics } from "@/lib/survey/area";
import type { FloorRow, SurveyDetail } from "@/schema/surveys/index";

type DemandMasters = {
  floors?: MasterOption[];
  usageTypes?: MasterOption[];
  usageFactors?: MasterOption[];
  constructionTypes?: MasterOption[];
};

/** Assessable sqft for demand when built-up total is zero (plinth → plot fallback). */
export function resolveAssessableSqft(survey: {
  plotSqft: number;
  plinthSqft: number;
  floors?: { floorName: string; areaSqft: number }[];
}): number {
  const areas = surveyAreaMetrics(survey);
  if (areas.builtUpSqft > 0) return areas.builtUpSqft;
  if (areas.plinthSqft > 0) return areas.plinthSqft;
  if (areas.plotSqft > 0) return areas.plotSqft;
  const floorSum = (survey.floors ?? []).reduce((s, f) => s + (f.areaSqft > 0 ? f.areaSqft : 0), 0);
  return floorSum;
}

/**
 * QC final report demand — uses the same ALV model as the demand notice when floors exist,
 * otherwise falls back to the simplified zone-rate estimate on assessable area.
 */
export function getQcReportDemand(
  survey: SurveyDetail,
  floors: FloorRow[] | undefined,
  masters?: DemandMasters,
  rateConfig?: TaxRateConfig | null,
): DemandAssessment & { assessableSqft: number } {
  const assessableSqft = resolveAssessableSqft(survey);

  if (floors && floors.length > 0) {
    const notice = computeDemandNotice(survey, floors, masters, rateConfig ?? undefined);
    if (notice.totalAnnualDemand > 0) {
      return {
        assessableSqft: notice.totalArea > 0 ? notice.totalArea : assessableSqft,
        lines: [
          { label: "Property Tax", amount: notice.propertyTax },
          { label: "Water Tax", amount: notice.waterTax },
          { label: "Drainage Tax", amount: notice.drainageTax },
        ],
        total: notice.totalAnnualDemand,
      };
    }
  }

  const fallback = estimateDemandAssessment(survey, assessableSqft);
  return { ...fallback, assessableSqft };
}
