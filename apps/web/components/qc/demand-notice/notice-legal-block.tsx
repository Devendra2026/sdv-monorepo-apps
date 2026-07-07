"use client";

import { DEMAND_NOTICE_LEGAL_COPY } from "@/lib/qc/demand-notice";
import { BilingualLabel } from "./bilingual-label";
import { SectionLabel } from "./section-label";

export function NoticeLegalBlock() {
  return (
    <section className="dn-section demand-notice-legal-section">
      <SectionLabel>
        <BilingualLabel en="Important Notice" hi="महत्वपूर्ण सूचना" />
      </SectionLabel>
      <p className="demand-notice-print-section-label">
        <BilingualLabel en="Important Notice" hi="महत्वपूर्ण सूचना" />
      </p>
      <div className="demand-notice-screen-legal rounded-lg border-2 border-(--dn-accent)/30 bg-(--dn-surface) p-(--dn-space-4) text-sm leading-relaxed text-(--dn-primary)">
        <p className="demand-notice-hi text-(--dn-primary)">{DEMAND_NOTICE_LEGAL_COPY.hindi}</p>
        <p className="demand-notice-hi mt-2 font-semibold text-(--dn-secondary)">
          {DEMAND_NOTICE_LEGAL_COPY.hindiNote}
        </p>
      </div>
      <div className="demand-notice-print-legal">
        <div className="demand-notice-legal-box overflow-hidden bg-white">
          <div className="demand-notice-legal-text">
            <p className="demand-notice-hi">{DEMAND_NOTICE_LEGAL_COPY.hindi}</p>
            <p className="demand-notice-hi mt-1.5 font-semibold">{DEMAND_NOTICE_LEGAL_COPY.hindiNote}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
