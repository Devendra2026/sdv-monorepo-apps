"use client";

import type { OfficeTitles } from "@/lib/qc/demand-notice";
import { NoticeLogo } from "./notice-watermark";

function MetadataCard({ label, value, propertyId }: { label: string; value: string; propertyId?: boolean }) {
  return (
    <div className="demand-notice-meta-card rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-center sm:text-left">
      <p className="dn-label dn-meta-label">{label}</p>
      <p className={propertyId ? "dn-value property-id" : "dn-value dn-meta-value"}>{value || "—"}</p>
    </div>
  );
}

export function NoticeHeader({
  office,
  propertyId,
  assessmentYear,
  noticeDate,
  logoUrl,
}: {
  office: OfficeTitles;
  propertyId: string;
  assessmentYear: string;
  noticeDate: string;
  logoUrl?: string | null;
}) {
  return (
    <header className="demand-notice-header dn-section relative z-1 rounded-md border border-slate-200 bg-white px-6 py-5 print:rounded-none print:border-black print:px-2 print:py-1.5">
      <div className="demand-notice-header-main grid grid-cols-12 items-start gap-4 print:flex print:items-center print:gap-2">
        <div className="demand-notice-header-logo col-span-12 flex justify-center md:col-span-2 md:justify-start print:shrink-0">
          <NoticeLogo ulbName={office.ulbName} logoUrl={logoUrl} />
        </div>

        <div className="demand-notice-header-title col-span-12 text-center md:col-span-10 print:min-w-0 print:flex-1">
          <p className="dn-print-office-name mt-1 text-sm font-bold text-slate-900 print:mt-0">{office.headerLine1}</p>
          <p className="dn-print-municipality mt-0.5 text-xs font-semibold text-slate-700">{office.headerLine2}</p>
          <h1 className="dn-print-notice-title mt-2 text-2xl font-extrabold tracking-wide text-[#0369a1] print:mt-1">
            Property Tax Demand Notice
          </h1>
          <p className="demand-notice-hi dn-print-notice-title-hi mt-1 text-sm font-medium text-slate-700">
            संपत्ति कर मांग सूचना पत्र
          </p>
        </div>
      </div>

      <div className="demand-notice-header-meta-strip demand-notice-header-details mt-4 grid grid-cols-1 gap-2 border-t border-slate-200 pt-3 sm:grid-cols-3 print:mt-1.5 print:gap-1.5 print:border-black print:pt-1.5">
        <MetadataCard label="Assessment Year" value={assessmentYear} />
        <MetadataCard label="Notice Date" value={noticeDate} />
        <MetadataCard label="Property ID" value={propertyId} propertyId />
      </div>
    </header>
  );
}
