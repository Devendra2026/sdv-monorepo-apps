"use client";

import { GlassCard, GlassCardHeader } from "@/components/design-system/glass-card";
import { QcPropertyUseCell } from "@/components/qc/qc-registry-cells";
import { QcStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Id } from "@/convex/_generated/dataModel";
import { useMasters } from "@/hooks/masters/useMasters";
import { useDecide, usePropertyIdConflicts } from "@/hooks/qc/useQc";
import { QC_DUPLICATE_BADGE, QC_TABLE } from "@/lib/design-system";
import { formatRegistryParcelNo, formatRegistryWardNo } from "@/lib/survey/format-registry-parcel";
import { buildUlbCodeMap, resolveDisplayPropertyId } from "@/lib/survey/resolve-display-property-id";
import { resolveOwnerDisplayName } from "@/lib/survey/resolve-owner-name";
import { cn } from "@/lib/utils";
import { AlertTriangle, Eye, Pencil } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const DUPLICATE_REJECT_COMMENT =
  "Duplicate Property ID — reject this record or correct ward, parcel, unit, or property use with the field team.";

export function QcPropertyIdConflictPanel({ surveyId, propertyId }: { surveyId: string; propertyId?: string }) {
  const conflicts = usePropertyIdConflicts(surveyId);
  const decide = useDecide();
  const { masters } = useMasters();
  const ulbCodes = useMemo(() => (masters ? buildUlbCodeMap(masters.ulbs) : undefined), [masters]);
  const propertyUses = masters?.propertyUses;
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  if (conflicts === undefined) return null;
  if (conflicts.length === 0) return null;

  const handleRejectDuplicate = async (targetId: string) => {
    setRejectingId(targetId);
    try {
      await decide({
        surveyId: targetId as Id<"surveys">,
        decision: "reject",
        comment: DUPLICATE_REJECT_COMMENT,
        taggedSections: ["property"],
      });
      toast.success("Record returned to surveyor for correction");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reject record");
    } finally {
      setRejectingId(null);
    }
  };

  return (
    <GlassCard padding="md" className={cn("border-red-500/35", QC_DUPLICATE_BADGE.conflictPanel)}>
      <GlassCardHeader
        title={`Duplicate Property ID${propertyId ? `: ${propertyId}` : ""}`}
        description="Another survey already uses this Property ID. Saves will fail until you reject the duplicate or change ward, parcel, unit, or property use on one record."
        icon={<AlertTriangle className="h-4 w-4 text-red-600" aria-hidden />}
      />

      <p className={cn("mb-4", QC_DUPLICATE_BADGE.conflictAlert)}>
        Compare owner, photos, and GPS with the conflicting record below. Keep the correct survey and reject or renumber
        the other.
      </p>

      <div className="overflow-x-auto">
        <Table className="min-w-200">
          <TableHeader>
            <TableRow className={QC_TABLE.headerRow}>
              <TableHead className={QC_TABLE.headerCell}>Property ID</TableHead>
              <TableHead className={QC_TABLE.headerCell}>Ward</TableHead>
              <TableHead className={QC_TABLE.headerCell}>Parcel</TableHead>
              <TableHead className={QC_TABLE.headerCell}>Unit</TableHead>
              <TableHead className={QC_TABLE.headerCell}>Property Use</TableHead>
              <TableHead className={QC_TABLE.headerCell}>Owner</TableHead>
              <TableHead className={QC_TABLE.headerCell}>QC</TableHead>
              <TableHead className={QC_TABLE.headerCell}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conflicts.map((row) => (
              <TableRow key={row._id} className={QC_TABLE.bodyRow}>
                <TableCell className={cn(QC_TABLE.monoCell, "py-2.5")}>
                  {resolveDisplayPropertyId(row, ulbCodes) ?? row.propertyId ?? "—"}
                </TableCell>
                <TableCell className="py-2.5 font-mono text-xs tabular-nums">
                  {formatRegistryWardNo(row.wardNo)}
                </TableCell>
                <TableCell className="py-2.5 font-mono text-xs tabular-nums">
                  {formatRegistryParcelNo(row.parcelNo)}
                </TableCell>
                <TableCell className="py-2.5 font-mono text-xs tabular-nums">{row.unitNo || "—"}</TableCell>
                <TableCell className="py-2.5">
                  <QcPropertyUseCell propertyUse={row.propertyUse} propertyUses={propertyUses} />
                </TableCell>
                <TableCell className="py-2.5 font-medium">{resolveOwnerDisplayName(row)}</TableCell>
                <TableCell className="py-2.5">
                  <QcStatusBadge status={row.qcStatus} />
                </TableCell>
                <TableCell className="py-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="h-7 cursor-pointer rounded-full px-2.5 text-xs"
                    >
                      <Link href={`/qc/${row._id}`}>
                        <Eye className="h-3 w-3" aria-hidden /> Review
                      </Link>
                    </Button>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="h-7 cursor-pointer rounded-full px-2.5 text-xs"
                    >
                      <Link href={`/qc/${row._id}/edit`}>
                        <Pencil className="h-3 w-3" aria-hidden /> Correct
                      </Link>
                    </Button>
                    {row.qcStatus === "pending" && row.status === "submitted" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className={cn(
                          "h-7 cursor-pointer rounded-full px-2.5 text-xs",
                          QC_DUPLICATE_BADGE.rejectButton,
                        )}
                        disabled={rejectingId === row._id}
                        onClick={() => void handleRejectDuplicate(row._id)}
                      >
                        Reject duplicate
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </GlassCard>
  );
}
