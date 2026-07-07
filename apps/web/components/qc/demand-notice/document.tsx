"use client";

import type { DemandNoticeDocumentProps } from "@/lib/qc/demand-notice-document-types";
import { DEFAULT_TAX_RATES } from "@/lib/qc/tax-rate-defaults";
import { NoticeAssessmentTable } from "./notice-assessment-table";
import { NoticeDemandSummary } from "./notice-demand-summary";
import { NoticeHeader } from "./notice-header";
import { NoticeLegalBlock } from "./notice-legal-block";
import { NoticePhotoGallery } from "./notice-photo-gallery";
import { NoticePrintLayout } from "./notice-print-layout";
import { NoticeOwnerProfile, NoticePropertySpecs } from "./notice-property-grid";
import { DemandNoticeBody, DemandNoticeSheet } from "./notice-sheet";
import { NoticeSignatureBlockScreen } from "./notice-signature-block";
import { NoticeWatermark } from "./notice-watermark";
import { pctLabel } from "./shared";

export type { DemandNoticeDocumentProps } from "@/lib/qc/demand-notice-document-types";

export function DemandNoticeDocument({
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
}: DemandNoticeDocumentProps) {
  const propPct = rateConfig ? pctLabel(rateConfig.propertyTaxPct) : pctLabel(DEFAULT_TAX_RATES.propertyTaxPct);
  const waterPct = rateConfig ? pctLabel(rateConfig.waterTaxPct) : "7.5%";
  const drainPct = rateConfig ? pctLabel(rateConfig.drainageTaxPct) : "2.5%";

  return (
    <DemandNoticeSheet floorCount={notice.floorRows.length}>
      <NoticeWatermark ulbName={office.ulbName} />
      <div className="block print:hidden" data-dn-layout="screen">
        <DemandNoticeBody className="bg-[#f3f4f6]">
          <div className="mx-auto w-full max-w-230 space-y-4">
            <NoticeHeader
              office={office}
              propertyId={propertyId}
              assessmentYear={assessmentYear}
              noticeDate={noticeDate}
              logoUrl={logoUrl}
            />
            <div className="grid gap-4 lg:grid-cols-2">
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
            <NoticeAssessmentTable
              notice={notice}
              propertyTaxPct={rateConfig?.propertyTaxPct ?? DEFAULT_TAX_RATES.propertyTaxPct}
              waterTaxPct={rateConfig?.waterTaxPct ?? DEFAULT_TAX_RATES.waterTaxPct}
              drainageTaxPct={rateConfig?.drainageTaxPct ?? DEFAULT_TAX_RATES.drainageTaxPct}
            />
            <NoticePhotoGallery survey={survey} frontPhoto={frontPhoto} sidePhoto={sidePhoto} />
            <div className="grid gap-4 lg:grid-cols-2">
              <NoticeDemandSummary notice={notice} propPct={propPct} waterPct={waterPct} drainPct={drainPct} />
              <NoticeLegalBlock />
            </div>
            <NoticeSignatureBlockScreen signatureUrl={signatureUrl} office={office} />
          </div>
        </DemandNoticeBody>
      </div>

      <NoticePrintLayout
        survey={survey}
        propertyId={propertyId}
        ownerName={ownerName}
        fatherName={fatherName}
        mobileNo={mobileNo}
        oldHouseNo={oldHouseNo}
        office={office}
        taxZone={taxZone}
        address={address}
        propertyUseLabel={propertyUseLabel}
        notice={notice}
        noticeDate={noticeDate}
        assessmentYear={assessmentYear}
        frontPhoto={frontPhoto}
        sidePhoto={sidePhoto}
        logoUrl={logoUrl}
        signatureUrl={signatureUrl}
        rateConfig={rateConfig}
      />
      <footer className="demand-notice-print-hide relative z-1 border-t border-(--dn-border) bg-(--dn-surface) px-6 py-3 text-center">
        <p className="text-[11px] leading-relaxed text-(--dn-secondary)">
          Computer-generated demand notice issued by the Municipal Board. Property ID:{" "}
          <span className="font-mono font-semibold text-(--dn-primary)">{propertyId}</span>
        </p>
      </footer>
    </DemandNoticeSheet>
  );
}
