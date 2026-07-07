"use client";

import { GlassCard, GlassCardHeader } from "@/components/design-system/glass-card";
import { QcPropertyUseCell } from "@/components/qc/qc-registry-cells";
import { QcStatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Id } from "@/convex/_generated/dataModel";
import { useMasters } from "@/hooks/masters/useMasters";
import { useDecide, useParcelSiblings } from "@/hooks/qc/useQc";
import { QC_DUPLICATE_BADGE, QC_TABLE } from "@/lib/design-system";
import { detectParcelConflict, type ParcelSiblingRow } from "@/lib/qc/parcel-siblings";
import { formatRegistryParcelNo, formatRegistryWardNo } from "@/lib/survey/format-registry-parcel";
import { buildUlbCodeMap, resolveDisplayPropertyId } from "@/lib/survey/resolve-display-property-id";
import { resolveOwnerDisplayName } from "@/lib/survey/resolve-owner-name";
import { cn } from "@/lib/utils";
import { AlertTriangle, Eye, Pencil } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const DUPLICATE_REJECT_COMMENT =
  "Duplicate parcel entry — please reassign parcel number or correct property use with field team.";

type PanelRow = ParcelSiblingRow & { isCurrent?: boolean };

export function QcParcelSiblingsPanel({
  surveyId,
  wardNo,
  parcelNo,
  currentSurvey,
}: {
  surveyId: string;
  wardNo: string;
  parcelNo: string;
  currentSurvey: ParcelSiblingRow;
}) {
  const siblings = useParcelSiblings(surveyId);
  const decide = useDecide();
  const { masters } = useMasters();
  const ulbCodes = useMemo(() => (masters ? buildUlbCodeMap(masters.ulbs) : undefined), [masters]);
  const propertyUses = masters?.propertyUses;
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const allOnParcel = useMemo(() => {
    if (!siblings) return undefined;
    return [currentSurvey, ...siblings];
  }, [siblings, currentSurvey]);

  const tableRows = useMemo((): PanelRow[] => {
    if (!siblings) return [];
    return [{ ...currentSurvey, isCurrent: true }, ...siblings.map((s) => ({ ...s, isCurrent: false }))];
  }, [siblings, currentSurvey]);

  const hasConflict = useMemo(() => {
    if (!allOnParcel) return false;
    return detectParcelConflict(allOnParcel);
  }, [allOnParcel]);

  if (siblings === undefined) return null;
  if (siblings.length === 0) return null;

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
    <GlassCard padding="md" className={cn("border-amber-500/30", QC_DUPLICATE_BADGE.conflictPanel)}>
      <GlassCardHeader
        title={`Other records on Ward ${formatRegistryWardNo(wardNo)} · Parcel ${formatRegistryParcelNo(parcelNo)}`}
        description={
          hasConflict
            ? "Multiple pending records share this parcel and unit with different owners — review each or return duplicates."
            : "Different property uses on the same parcel are valid when each use type is correct on site."
        }
        icon={<AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />}
      />

      {hasConflict && (
        <p className={cn("mb-4", QC_DUPLICATE_BADGE.conflictAlert)}>
          Likely field numbering overlap — compare photos and GPS before approving both records.
        </p>
      )}

      <div className="overflow-x-auto">
        <Table className="min-w-200">
          <TableHeader>
            <TableRow className={QC_TABLE.headerRow}>
              <TableHead className={QC_TABLE.headerCell}>Property ID</TableHead>
              <TableHead className={QC_TABLE.headerCell}>Ward</TableHead>
              <TableHead className={QC_TABLE.headerCell}>Parcel</TableHead>
              <TableHead className={QC_TABLE.headerCell}>Property Use</TableHead>
              <TableHead className={QC_TABLE.headerCell}>Owner</TableHead>
              <TableHead className={QC_TABLE.headerCell}>QC</TableHead>
              <TableHead className={QC_TABLE.headerCell}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableRows.map((row) => (
              <TableRow
                key={row._id}
                className={cn(QC_TABLE.bodyRow, row.isCurrent && QC_DUPLICATE_BADGE.currentRowHighlight)}
              >
                <TableCell className={cn(QC_TABLE.monoCell, "py-2.5")}>
                  {resolveDisplayPropertyId(row, ulbCodes) ?? row.propertyId ?? "—"}
                  {row.isCurrent && (
                    <span className="ml-2 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-950 dark:text-amber-100">
                      Current
                    </span>
                  )}
                </TableCell>
                <TableCell className="py-2.5 font-mono text-xs tabular-nums">
                  {formatRegistryWardNo(row.wardNo)}
                </TableCell>
                <TableCell className="py-2.5 font-mono text-xs tabular-nums">
                  {formatRegistryParcelNo(row.parcelNo)}
                </TableCell>
                <TableCell className="py-2.5">
                  <QcPropertyUseCell propertyUse={row.propertyUse} propertyUses={propertyUses} />
                </TableCell>
                <TableCell className="py-2.5 font-medium">{resolveOwnerDisplayName(row)}</TableCell>
                <TableCell className="py-2.5">
                  <QcStatusBadge status={row.qcStatus} />
                </TableCell>
                <TableCell className="py-2.5">
                  {!row.isCurrent && (
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
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </GlassCard>
  );
}
