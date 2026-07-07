"use client";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DemandRegisterRow } from "@/hooks/qc/useDemandNoticePanel";
import { formatAreaSqft } from "@/lib/survey/area";
import { ExternalLink, Eye, Printer } from "lucide-react";

type DemandNoticeRegisterTableProps = {
  rows: DemandRegisterRow[];
  onPreview: (row: DemandRegisterRow) => void;
};

export function DemandNoticeRegisterTable({ rows, onPreview }: DemandNoticeRegisterTableProps) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        No approved properties for this scope.
      </p>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border/60 lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Property ID</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Ward</TableHead>
              <TableHead>Parcel</TableHead>
              <TableHead className="text-right">Assessable</TableHead>
              <TableHead className="text-right">Annual Demand</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.surveyId}>
                <TableCell className="font-medium">{row.propertyId}</TableCell>
                <TableCell>{row.ownerName}</TableCell>
                <TableCell>{row.wardNo}</TableCell>
                <TableCell>{row.parcelNo}</TableCell>
                <TableCell className="text-right">{formatAreaSqft(row.assessableSqft)}</TableCell>
                <TableCell className="text-right font-semibold">{row.annualDemandLabel}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => onPreview(row)}>
                      <Eye className="mr-1 h-4 w-4" /> Preview
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <a href={`/reports/demand-notices/${row.surveyId}`} target="_blank" rel="noreferrer">
                        <Printer className="mr-1 h-4 w-4" /> Print
                      </a>
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <a href={`/reports/demand-notices/${row.surveyId}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-1 h-4 w-4" /> Open
                      </a>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 lg:hidden">
        {rows.map((row) => (
          <article key={row.surveyId} className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
            <p className="text-sm font-semibold">{row.propertyId}</p>
            <p className="mt-1 text-sm text-muted-foreground">{row.ownerName}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <p>Ward: {row.wardNo}</p>
              <p>Parcel: {row.parcelNo}</p>
              <p>Area: {formatAreaSqft(row.assessableSqft)}</p>
              <p className="font-semibold">Demand: {row.annualDemandLabel}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="min-h-11" onClick={() => onPreview(row)}>
                <Eye className="mr-1 h-4 w-4" /> Preview
              </Button>
              <Button asChild size="sm" variant="ghost" className="min-h-11">
                <a href={`/reports/demand-notices/${row.surveyId}`} target="_blank" rel="noreferrer">
                  <Printer className="mr-1 h-4 w-4" /> Print
                </a>
              </Button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
