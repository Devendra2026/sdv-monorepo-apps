"use client";

import type { DemandNoticeData } from "@/lib/qc/demand-notice";
import type { SurveyDetail } from "@/schema/surveys/index";
import { Building2, Hash, Home, MapPin, Phone, User } from "lucide-react";
import { BilingualLabel } from "./bilingual-label";

function maskMobileNo(mobileNo: string): string {
  const digits = mobileNo.replace(/\D/g, "");
  if (digits.length < 4) return mobileNo || "—";
  const visible = digits.slice(-4);
  return `XXXXXX${visible}`;
}

type SharedProps = {
  survey: SurveyDetail;
  propertyId: string;
  ownerName: string;
  fatherName: string;
  mobileNo: string;
  oldHouseNo: string;
  taxZone: string;
  address: string;
  propertyUseLabel: string;
  notice: DemandNoticeData;
};

function DataCell({
  label,
  value,
  icon: Icon,
  mono,
  wide,
}: {
  label: string;
  value: string;
  icon: typeof Home;
  mono?: boolean;
  wide?: boolean;
}) {
  return (
    <div
      className={`dn-field-cell rounded-md border border-slate-100 bg-slate-50/80 px-4 py-3 ${wide ? "sm:col-span-2 dn-field-wide" : ""}`}
    >
      <dt className="dn-label dn-field-label inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <Icon className="h-3.5 w-3.5 text-slate-400 print:hidden" aria-hidden />
        {label}
      </dt>
      <dd
        className={`dn-value dn-dynamic-value mt-1 text-sm font-bold text-slate-800 ${mono ? "property-id font-mono" : ""}`}
      >
        {value || "—"}
      </dd>
    </div>
  );
}

export function NoticePropertySpecs({ survey, oldHouseNo, taxZone, propertyUseLabel }: SharedProps) {
  return (
    <section className="dn-section demand-notice-property-section rounded-md border border-slate-200 bg-white p-4 print:p-2">
      <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
        <Hash className="h-4 w-4 text-[#4648d4]" aria-hidden />
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-700">
          <BilingualLabel en="Property Specifications" hi="संपत्ति विनिर्देश" />
        </p>
      </div>
      <dl className="dn-field-grid grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DataCell label="Road Width Zone" value={taxZone || "—"} icon={Home} />
        <DataCell label="Ward No" value={survey.wardNo ? `Ward No. ${survey.wardNo}` : "—"} icon={Hash} />
        <DataCell label="Old House No" value={oldHouseNo || "—"} icon={Building2} mono />
        <DataCell label="GIS Parcel" value={survey.parcelNo || "—"} icon={MapPin} mono />
        <DataCell label="Property Use" value={propertyUseLabel || "—"} icon={Home} />
      </dl>
    </section>
  );
}

export function NoticeOwnerProfile({ ownerName, fatherName, mobileNo, address }: SharedProps) {
  const maskedMobile = maskMobileNo(mobileNo);
  return (
    <section className="dn-section rounded-md border border-slate-200 bg-white p-4 print:p-2">
      <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
        <User className="h-4 w-4 text-[#4648d4]" aria-hidden />
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-700">
          <BilingualLabel en="Owner Profile" hi="स्वामी विवरण" />
        </p>
      </div>
      <dl className="dn-field-grid grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DataCell label="Property Owner Name" value={ownerName || "—"} icon={User} />
        <DataCell label="Father/Husband Name" value={fatherName || "—"} icon={User} />
        <DataCell label="Mobile Number" value={maskedMobile} icon={Phone} mono />
        <DataCell label="Address" value={address || "—"} icon={MapPin} wide />
      </dl>
    </section>
  );
}
