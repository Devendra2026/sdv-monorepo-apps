"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatAmountPlain, type DemandNoticeData } from "@/lib/qc/demand-notice";
import { BilingualLabel } from "./bilingual-label";
import { SectionLabel } from "./section-label";

export function NoticeAssessmentTable({
  notice,
  propertyTaxPct,
  waterTaxPct: _waterTaxPct,
  drainageTaxPct: _drainageTaxPct,
}: {
  notice: DemandNoticeData;
  propertyTaxPct: number;
  waterTaxPct: number;
  drainageTaxPct: number;
}) {
  const effectivePct = (propertyTaxPct * 100).toFixed(1).replace(/\.0$/, "");

  return (
    <section className="dn-section demand-notice-table-section rounded-md border border-slate-200 bg-white p-4 print:p-2">
      <div className="mb-4 border-b border-slate-200 pb-3 print:mb-0 print:border-0 print:pb-0">
        <SectionLabel>
          <BilingualLabel en="Assessment & ALV Calculation Details" hi="मूल्यांकन एवं वार्षिक मूल्यांकन विवरण" />
        </SectionLabel>
        <p className="demand-notice-print-section-label">
          <BilingualLabel en="Assessment & ALV Calculation Details" hi="मूल्यांकन एवं वार्षिक मूल्यांकन विवरण" />
        </p>
      </div>
      <div className="overflow-hidden rounded-md border border-slate-200 print:rounded-none">
        <div className="overflow-x-auto print:overflow-visible">
          <Table className="dn-zebra-table min-w-180 w-full print:min-w-0 print:text-[6px]">
            <TableHeader>
              <TableRow className="border-b border-slate-200 bg-slate-50 hover:bg-slate-50">
                <TableHead className="text-center text-[10px] font-bold uppercase tracking-widest text-slate-700 print:px-1 print:py-0.5 print:text-[6px]">
                  S.No
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-700 print:px-1 print:py-0.5 print:text-[6px]">
                  <BilingualLabel en="Floor" hi="तल" />
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-700 print:px-1 print:py-0.5 print:text-[6px]">
                  <BilingualLabel en="Usage Type" hi="उपयोग प्रकार" />
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-700 print:px-1 print:py-0.5 print:text-[6px]">
                  <BilingualLabel en="Usage Factor" hi="उपयोग कारक" />
                </TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-700 print:px-1 print:py-0.5 print:text-[6px]">
                  <BilingualLabel en="Construction" hi="निर्माण" />
                </TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-widest text-slate-700 print:px-1 print:py-0.5 print:text-[6px]">
                  <BilingualLabel en="Area (SqFt)" hi="क्षेत्रफल" />
                </TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-widest text-slate-700 print:px-1 print:py-0.5 print:text-[6px]">
                  <BilingualLabel en="Rate (₹)" hi="दर" />
                </TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-widest text-slate-700 print:px-1 print:py-0.5 print:text-[6px]">
                  <BilingualLabel en="ALV (₹)" hi="वार्षिक मूल्यांकन" />
                </TableHead>
                <TableHead className="text-right text-[10px] font-bold uppercase tracking-widest text-slate-700 print:px-1 print:py-0.5 print:text-[6px]">
                  <BilingualLabel en={`Tax (${effectivePct})`} hi="कर" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notice.floorRows.length > 0 ? (
                notice.floorRows.map((row, i) => (
                  <TableRow
                    key={`${row.floorLabel}-${i}`}
                    className="border-b border-slate-200 text-sm even:bg-slate-50/70 print:text-[7px]"
                  >
                    <TableCell className="text-center font-mono tabular-nums print:px-1 print:py-0.5">
                      {i + 1}
                    </TableCell>
                    <TableCell className="font-semibold text-slate-900 print:px-1 print:py-0.5">
                      {row.floorLabel}
                    </TableCell>
                    <TableCell className="text-slate-700 print:px-1 print:py-0.5">
                      {row.usageTypeLabel || "—"}
                    </TableCell>
                    <TableCell className="text-slate-700 print:px-1 print:py-0.5">
                      {row.usageFactorLabel || "—"}
                    </TableCell>
                    <TableCell className="text-slate-700 print:px-1 print:py-0.5">{row.constructionLabel}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums print:px-1 print:py-0.5">
                      {formatAmountPlain(row.areaSqft)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums print:px-1 print:py-0.5">
                      {formatAmountPlain(row.monthlyRate)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums print:px-1 print:py-0.5">
                      {formatAmountPlain(row.alv)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold tabular-nums print:px-1 print:py-0.5">
                      {formatAmountPlain(row.tax)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="py-8 text-center text-sm text-muted-foreground print:py-2 print:text-[7px]"
                  >
                    No floor assessment data available
                  </TableCell>
                </TableRow>
              )}
              {notice.floorRows.length > 0 && (
                <TableRow className="border-t-2 border-(--dn-border) bg-slate-100 font-bold print:text-[7px]">
                  <TableCell colSpan={5} className="uppercase tracking-wide text-slate-900 print:px-1 print:py-0.5">
                    Total
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums print:px-1 print:py-0.5">
                    {formatAmountPlain(notice.totalArea)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums print:px-1 print:py-0.5">—</TableCell>
                  <TableCell className="text-right font-mono tabular-nums print:px-1 print:py-0.5">
                    {formatAmountPlain(notice.totalAlv)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-base font-bold tabular-nums text-indigo-800 print:px-1 print:py-0.5 print:text-[7px]">
                    {formatAmountPlain(notice.totalTax)}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
}
