"use client";

import type { DemandRegisterRow } from "@/hooks/qc/useDemandNoticePanel";

export function DemandNoticeRegisterPrint({
  rows,
  scopeLabel,
  totalAnnualDemandLabel,
  reportDateLabel,
}: {
  rows: DemandRegisterRow[];
  scopeLabel: string;
  totalAnnualDemandLabel: string;
  reportDateLabel: string;
}) {
  return (
    <section className="demand-register-print hidden print:block" aria-hidden="true">
      <header className="mb-2 print:mb-3">
        <h1 className="text-base font-bold print:text-lg">Demand Notice Register</h1>
        <p className="text-xs print:text-sm">Scope: {scopeLabel}</p>
        <p className="text-xs print:text-sm">Notice date: {reportDateLabel}</p>
        <p className="text-xs print:text-sm">Total Annual Demand (page): {totalAnnualDemandLabel}</p>
        <p className="text-xs print:text-sm">{rows.length.toLocaleString()} properties on this page</p>
      </header>
      <table>
        <colgroup>
          <col className="col-serial" />
          <col className="col-property" />
          <col className="col-owner" />
          <col className="col-ward" />
          <col className="col-parcel" />
          <col className="col-demand" />
        </colgroup>
        <thead>
          <tr>
            <th className="col-serial">#</th>
            <th className="col-property">Property ID</th>
            <th className="col-owner">Owner</th>
            <th className="col-ward">Ward</th>
            <th className="col-parcel">Parcel</th>
            <th className="col-demand">Demand</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.surveyId}>
              <td>{index + 1}</td>
              <td>{row.propertyId}</td>
              <td>{row.ownerName}</td>
              <td>{row.wardNo}</td>
              <td>{row.parcelNo}</td>
              <td className="col-demand">{row.annualDemandLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
