import {
  buildOfficeTitles,
  buildSurveyAddress,
  computeDemandNotice,
  formatNoticeDate,
  type TaxRateConfig,
} from "@/lib/qc/demand-notice";
import type { DemandNoticeDocumentProps, DemandNoticeMastersBundle } from "@/lib/qc/demand-notice-document-types";
import { reportDocumentTimestamp } from "@/lib/qc/report-dates";
import { labelFromOptions } from "@/lib/survey/detail-labels";
import { buildUlbCodeMap, resolveDisplayPropertyId } from "@/lib/survey/resolve-display-property-id";
import type { FloorRow, SurveyDetail, SurveyListItem } from "@/schema/surveys/index";

type MastersBundle = DemandNoticeMastersBundle;

export type { DemandNoticeMastersBundle };

export type DemandNoticePhotoUrls = {
  front?: string | null;
  side?: string | null;
};

export function toSurveyDetail(survey: SurveyListItem, floors: FloorRow[]): SurveyDetail {
  return {
    ...survey,
    floors,
    photos: [],
    qcRemarks: [],
    surveyor: null,
  };
}

export function buildDemandNoticeDocumentProps(
  survey: SurveyListItem,
  floors: FloorRow[],
  masters: MastersBundle,
  rateConfig: TaxRateConfig,
  reportDateMs: number = reportDocumentTimestamp(),
  photoUrls?: DemandNoticePhotoUrls,
  signatureUrl?: string | null,
): DemandNoticeDocumentProps {
  const detail = toSurveyDetail(survey, floors);
  const ulbCodes = buildUlbCodeMap(masters.ulbs);
  const propertyId = resolveDisplayPropertyId(detail, ulbCodes) ?? detail.propertyId ?? detail.parcelNo;
  const primaryOwner = detail.owners?.[0];
  const ownerName = detail.respondentName || primaryOwner?.name || "—";
  const fatherName = primaryOwner?.fatherOrHusbandName?.trim() || "—";
  const mobileNo = primaryOwner?.mobileNo?.trim() || detail.mobileNo?.trim() || "—";
  const oldHouseNo = detail.oldPropertyNo?.trim() || "—";
  const ulb = masters.ulbs?.find((m) => m._id === detail.municipalityId);
  const district = masters.districts?.find((d) => d._id === detail.districtId);
  const cityName = ulb?.name ?? detail.city ?? "—";
  const districtName = district?.name ?? "—";
  const stateName = district?.stateName ?? ulb?.stateName ?? "Uttar Pradesh";
  const office = buildOfficeTitles(cityName, stateName, ulb?.bodyType, districtName);
  const taxZone = labelFromOptions(masters.taxRateZones, detail.taxRateZone) || detail.taxRateZone || "—";
  const address = buildSurveyAddress(detail);
  const propertyUseLabel =
    labelFromOptions(masters.propertyUses, detail.propertyUse) ||
    labelFromOptions(masters.usageTypes, detail.floors?.[0]?.usageType) ||
    detail.propertyUse ||
    "—";
  const notice = computeDemandNotice(detail, floors, masters, rateConfig);
  const noticeDate = formatNoticeDate(reportDateMs);
  const assessmentYear = detail.assessmentYear || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;

  return {
    survey: detail,
    propertyId,
    ownerName,
    fatherName,
    mobileNo,
    oldHouseNo,
    office,
    taxZone,
    address,
    propertyUseLabel,
    notice,
    noticeDate,
    assessmentYear,
    frontPhoto: photoUrls?.front ?? null,
    sidePhoto: photoUrls?.side ?? null,
    signatureUrl: signatureUrl ?? null,
    rateConfig,
  };
}
