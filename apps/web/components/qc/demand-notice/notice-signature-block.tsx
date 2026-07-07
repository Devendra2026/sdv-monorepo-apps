"use client";

import type { OfficeTitles } from "@/lib/qc/demand-notice";
import Image from "next/image";

type SignatureBlockProps = {
  signatureUrl?: string | null;
  office?: OfficeTitles;
};

function SignatureContent({ signatureUrl, office }: SignatureBlockProps) {
  return (
    <>
      {signatureUrl ? (
        <Image
          src={signatureUrl}
          alt="Executive Officer signature"
          width={180}
          height={52}
          unoptimized
          className="demand-notice-signature-image mb-1 h-12 w-auto max-w-45 object-contain object-right"
        />
      ) : (
        <p className="demand-notice-signature-sd">Sd/-</p>
      )}
      <p className="demand-notice-signature-title">Executive Officer</p>
      <p className="demand-notice-hi demand-notice-signature-title-hi">अधिशासी अधिकारी</p>
      {office ? (
        <>
          <p className="demand-notice-signature-office mt-1 text-[10px] font-semibold text-slate-700">
            {office.headerLine1}
          </p>
          <p className="demand-notice-signature-office-line text-[10px] text-slate-600">{office.headerLine2}</p>
        </>
      ) : null}
    </>
  );
}

export function NoticeSignatureBlock({ signatureUrl, office }: SignatureBlockProps) {
  return (
    <section className="dn-section demand-notice-print-only demand-notice-signature-block">
      <div className="demand-notice-signature-inner">
        <SignatureContent signatureUrl={signatureUrl} office={office} />
      </div>
    </section>
  );
}

export function NoticeSignatureBlockScreen({ signatureUrl, office }: SignatureBlockProps) {
  return (
    <section className="dn-section demand-notice-print-hide">
      <div className="grid grid-cols-1 gap-4">
        <div className="rounded-lg border border-(--dn-border) bg-white p-4 text-right">
          <SignatureContent signatureUrl={signatureUrl} office={office} />
        </div>
      </div>
    </section>
  );
}
