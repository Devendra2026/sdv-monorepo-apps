import type { DemandNoticeData, OfficeTitles } from "@/lib/qc/demand-notice";
import type { SurveyDetail } from "@/schema/surveys/index";

export type DemandNoticeMastersBundle = {
  ulbs?: Array<{
    _id: string;
    code: string;
    name: string;
    bodyType?: string;
    stateName?: string;
    districtId?: string;
  }>;
  districts?: Array<{ _id: string; name: string; stateName?: string }>;
  taxRateZones?: Array<{ value: string; label: string }>;
  floors?: Array<{ value: string; label: string }>;
  usageTypes?: Array<{ value: string; label: string }>;
  usageFactors?: Array<{ value: string; label: string }>;
  constructionTypes?: Array<{ value: string; label: string }>;
  propertyUses?: Array<{ value: string; label: string }>;
};

export type DemandNoticeDocumentProps = {
  survey: SurveyDetail;
  propertyId: string;
  ownerName: string;
  fatherName: string;
  mobileNo: string;
  oldHouseNo: string;
  office: OfficeTitles;
  taxZone: string;
  address: string;
  propertyUseLabel: string;
  notice: DemandNoticeData;
  noticeDate: string;
  assessmentYear: string;
  frontPhoto?: string | null;
  sidePhoto?: string | null;
  logoUrl?: string | null;
  signatureUrl?: string | null;
  rateConfig?: { propertyTaxPct: number; waterTaxPct: number; drainageTaxPct: number } | null;
};
