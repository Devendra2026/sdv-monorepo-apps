"use client";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { QcFinalReportRow } from "@/hooks/reports/useQcFinalReportPanel";
import { formatWardTitle } from "@/lib/reports/group-by-ward";
import { formatAreaSqft } from "@/lib/survey/area";
import { cn } from "@/lib/utils";
import { ChevronDown, ExternalLink, FileText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type WardGroup = {
  wardNo: string;
  wardLabel?: string;
  city: string;
  rows: QcFinalReportRow[];
};

function WardSection({ group, defaultOpen }: { group: WardGroup; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const title = formatWardTitle(group.wardNo, group.wardLabel);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="overflow-hidden rounded-xl border border-border/70 bg-card"
    >
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between gap-3 border-b border-border/50 bg-muted/30 px-4 py-3 text-left transition-colors hover:bg-muted/50">
        <div className="min-w-0">
          <p className="font-display text-sm font-bold text-foreground">{title}</p>
          {group.city ? <p className="text-xs text-muted-foreground">{group.city}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            {group.rows.length.toLocaleString()} approved
          </span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="hidden overflow-x-auto lg:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property ID</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Parcel</TableHead>
                <TableHead className="text-right">Assessable</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.rows.map((row) => (
                <TableRow key={row.surveyId}>
                  <TableCell className="font-medium">{row.propertyId}</TableCell>
                  <TableCell>{row.ownerName}</TableCell>
                  <TableCell>{row.parcelNo}</TableCell>
                  <TableCell className="text-right">{formatAreaSqft(row.assessableSqft)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button asChild size="sm" variant="outline" className="cursor-pointer">
                        <Link href={`/qc/${row.surveyId}/report`}>
                          <FileText className="mr-1 h-4 w-4" /> View Report
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="ghost" className="cursor-pointer">
                        <Link href={`/qc/${row.surveyId}/report`} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1 h-4 w-4" /> Open
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-3 p-3 lg:hidden">
          {group.rows.map((row) => (
            <article key={row.surveyId} className="rounded-lg border border-border/60 bg-background/60 p-3">
              <p className="text-sm font-semibold">{row.propertyId}</p>
              <p className="mt-1 text-sm text-muted-foreground">{row.ownerName}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <p>Parcel: {row.parcelNo}</p>
                <p>Area: {formatAreaSqft(row.assessableSqft)}</p>
              </div>
              <Button asChild size="sm" variant="outline" className="mt-3 min-h-11 w-full cursor-pointer">
                <Link href={`/qc/${row.surveyId}/report`}>
                  <FileText className="mr-1 h-4 w-4" /> View QC Final Report
                </Link>
              </Button>
            </article>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function QcFinalReportWardList({ wardGroups }: { wardGroups: WardGroup[] }) {
  if (wardGroups.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        No QC-approved properties for this scope. Adjust district, ULB, or ward filters.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {wardGroups.map((group, index) => (
        <WardSection key={`${group.wardNo}-${group.city}`} group={group} defaultOpen={index < 3} />
      ))}
    </div>
  );
}
