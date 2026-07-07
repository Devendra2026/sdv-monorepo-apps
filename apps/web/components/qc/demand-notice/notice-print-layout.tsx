"use client";

import type { DemandNoticeData, OfficeTitles } from "@/lib/qc/demand-notice";
import { DEFAULT_TAX_RATES } from "@/lib/qc/tax-rate-defaults";
import type { SurveyDetail } from "@/schema/surveys/index";
import { NoticeAssessmentTable } from "./notice-assessment-table";
import { NoticeDemandSummary } from "./notice-demand-summary";
import { NoticeHeader } from "./notice-header";
import { NoticeLegalBlock } from "./notice-legal-block";
import { NoticePhotoGallery } from "./notice-photo-gallery";
import { NoticeOwnerProfile, NoticePropertySpecs } from "./notice-property-grid";
import { DemandNoticeBody } from "./notice-sheet";
import { NoticeSignatureBlock } from "./notice-signature-block";
import { pctLabel } from "./shared";

export type NoticePrintLayoutProps = {
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

/** Dedicated A4 print layout — fills printable height via CSS flex, not JS shrink. */
export function NoticePrintLayout({
  survey,
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
  frontPhoto,
  sidePhoto,
  logoUrl,
  signatureUrl,
  rateConfig,
}: NoticePrintLayoutProps) {
  const propPct = rateConfig ? pctLabel(rateConfig.propertyTaxPct) : pctLabel(DEFAULT_TAX_RATES.propertyTaxPct);
  const waterPct = rateConfig ? pctLabel(rateConfig.waterTaxPct) : "7.5%";
  const drainPct = rateConfig ? pctLabel(rateConfig.drainageTaxPct) : "2.5%";

  return (
    <div className="print-page demand-notice-print-root hidden print:flex" data-dn-layout="print">
      <NoticeHeader
        office={office}
        propertyId={propertyId}
        assessmentYear={assessmentYear}
        noticeDate={noticeDate}
        logoUrl={logoUrl}
      />
      <DemandNoticeBody className="demand-notice-print-body">
        <div className="demand-notice-property-row">
          <NoticePropertySpecs
            survey={survey}
            propertyId={propertyId}
            ownerName={ownerName}
            fatherName={fatherName}
            mobileNo={mobileNo}
            oldHouseNo={oldHouseNo}
            taxZone={taxZone}
            address={address}
            propertyUseLabel={propertyUseLabel}
            notice={notice}
          />
          <NoticeOwnerProfile
            survey={survey}
            propertyId={propertyId}
            ownerName={ownerName}
            fatherName={fatherName}
            mobileNo={mobileNo}
            oldHouseNo={oldHouseNo}
            taxZone={taxZone}
            address={address}
            propertyUseLabel={propertyUseLabel}
            notice={notice}
          />
        </div>

        <div className="demand-notice-imagery-row">
          <NoticePhotoGallery survey={survey} frontPhoto={frontPhoto} sidePhoto={sidePhoto} variant="print" />
        </div>

        <NoticeAssessmentTable
          notice={notice}
          propertyTaxPct={rateConfig?.propertyTaxPct ?? DEFAULT_TAX_RATES.propertyTaxPct}
          waterTaxPct={rateConfig?.waterTaxPct ?? DEFAULT_TAX_RATES.waterTaxPct}
          drainageTaxPct={rateConfig?.drainageTaxPct ?? DEFAULT_TAX_RATES.drainageTaxPct}
        />

        <div className="demand-notice-tax-row">
          <NoticeDemandSummary notice={notice} propPct={propPct} waterPct={waterPct} drainPct={drainPct} />
        </div>

        <NoticeLegalBlock />

        <div className="demand-notice-signature-section">
          <NoticeSignatureBlock signatureUrl={signatureUrl} office={office} />
        </div>

        <div className="demand-notice-print-footer">
          <p className="demand-notice-print-footer-inner demand-notice-print-only">
            <span className="dn-footer-ref">Property Reference: {propertyId}</span>
            <span className="dn-footer-sep" aria-hidden>
              {" "}
              ·{" "}
            </span>
            <span>Computer-generated demand notice issued by the Municipal Board. Property ID: {propertyId}</span>
          </p>
        </div>
      </DemandNoticeBody>
    </div>
  );
}
