"use client";

import { formatInr, type DemandNoticeData } from "@/lib/qc/demand-notice";
import { BilingualLabel } from "./bilingual-label";
import { SectionLabel } from "./section-label";

export function NoticeDemandSummary({
  notice,
  propPct,
  waterPct,
  drainPct,
}: {
  notice: DemandNoticeData;
  propPct: string;
  waterPct: string;
  drainPct: string;
}) {
  const rows = [
    { label: `Property Tax (${propPct})`, value: notice.propertyTax },
    { label: `Water Tax (${waterPct})`, value: notice.waterTax },
    { label: `Drainage Tax (${drainPct})`, value: notice.drainageTax },
  ];

  return (
    <section className="dn-section demand-notice-summary-panel rounded-md border border-slate-200 bg-white p-4 print:border-2 print:border-[#0369a1] print:bg-[#eef2ff] print:p-1.5">
      <SectionLabel>
        <BilingualLabel en="Tax Demand Summary" hi="कर मांग सारांश" />
      </SectionLabel>
      <p className="demand-notice-print-section-label">
        <BilingualLabel en="Tax Demand Summary" hi="कर मांग सारांश" />
      </p>
      <div className="demand-notice-summary-box rounded-lg border border-slate-200 bg-white print:rounded-none print:border-0 print:bg-transparent">
        <div className="demand-notice-summary-grid print:grid print:grid-cols-4 print:gap-1.5">
          {rows.map((row) => (
            <div
              key={row.label}
              className="demand-notice-summary-item flex items-center justify-between border-b border-slate-100 px-4 py-3 last:border-b-0 print:flex-col print:items-stretch print:justify-center print:rounded-sm print:border print:border-[#0369a1]/30 print:bg-white print:px-1.5 print:py-1.5 print:text-center"
            >
              <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500 print:text-[6px] print:leading-tight">
                {row.label}
              </p>
              <p className="font-mono text-lg font-semibold tabular-nums text-slate-800 print:text-[9px] print:font-bold">
                {formatInr(row.value)}
              </p>
            </div>
          ))}
          <div className="demand-notice-summary-total flex items-center justify-between rounded-b-lg border-t-2 border-emerald-400 bg-emerald-50 px-4 py-4 print:col-span-1 print:flex-col print:justify-center print:rounded-sm print:border-2 print:border-emerald-600 print:bg-emerald-100 print:px-1.5 print:py-1.5 print:text-center">
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-emerald-800 print:text-[6px] print:leading-tight">
              <BilingualLabel en="Total Demand" hi="कुल मांग" />
            </p>
            <p className="font-mono text-2xl font-extrabold tabular-nums text-emerald-700 print:text-[11px] print:font-black">
              {notice.totalAnnualDemand > 0 ? formatInr(notice.totalAnnualDemand) : "—"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
