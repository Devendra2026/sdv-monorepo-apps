"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { MasterOption } from "@/convex/areaMasters";
import { QC_DUPLICATE_BADGE } from "@/lib/design-system";
import type { ParcelSiblingIndex, ParcelSiblingRow } from "@/lib/qc/parcel-siblings";
import { hasDifferentOwnersOnParcel } from "@/lib/qc/parcel-siblings";
import { formatPropertyUseLabel, formatRegistrySlotLabel } from "@/lib/qc/registry-display";
import { formatRegistryParcelNo } from "@/lib/survey/format-registry-parcel";
import { resolveDisplayPropertyId } from "@/lib/survey/resolve-display-property-id";
import { resolveOwnerDisplayName } from "@/lib/survey/resolve-owner-name";
import { cn } from "@/lib/utils";
import { Users } from "lucide-react";

export function QcPropertyUseCell({
  propertyUse,
  propertyUses,
}: {
  propertyUse?: string;
  propertyUses?: MasterOption[];
}) {
  return <span className="text-sm font-medium">{formatPropertyUseLabel(propertyUse, propertyUses)}</span>;
}

function QcParcelDuplicateBadge({
  row,
  siblingIndex,
  ulbCodes,
}: {
  row: ParcelSiblingRow;
  siblingIndex?: ParcelSiblingIndex;
  ulbCodes?: Map<string, string>;
}) {
  if (!siblingIndex) return null;

  const siblingCount = siblingIndex.countByRowId.get(row._id) ?? 1;
  if (siblingCount < 2) return null;

  const differentOwners = hasDifferentOwnersOnParcel(row, siblingIndex);
  const ownerCount = siblingIndex.ownerCountByRowId.get(row._id) ?? siblingCount;
  const siblings = siblingIndex.siblingsByRowId.get(row._id) ?? [];
  const hasConflict = siblingIndex.conflictRowIds.has(row._id);

  const label = differentOwners ? `Duplicate · ${ownerCount} owners` : `${siblingCount} on parcel`;

  const ariaLabel = differentOwners
    ? `Parcel shared with ${ownerCount} different owners`
    : `Parcel shared with ${siblingCount} records`;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            aria-label={ariaLabel}
            className={cn(
              "inline-flex w-fit cursor-default items-center gap-1 text-[10px] font-semibold",
              differentOwners ? QC_DUPLICATE_BADGE.duplicate : QC_DUPLICATE_BADGE.shared,
            )}
          >
            {differentOwners && <Users className="h-3 w-3 shrink-0" aria-hidden />}
            {label}
            {hasConflict && differentOwners ? " · review" : ""}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          <p className="mb-1.5 font-semibold">
            {differentOwners ? "Different owners on this parcel" : "Other records on this parcel"}
          </p>
          <ul className="space-y-1">
            {siblings.map((s) => (
              <li key={s._id} className="font-mono">
                {resolveDisplayPropertyId(s, ulbCodes) ?? s.propertyId ?? "—"} — {resolveOwnerDisplayName(s)}
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function QcParcelNumberCell({
  row,
  siblingIndex,
  ulbCodes,
}: {
  row: ParcelSiblingRow;
  siblingIndex?: ParcelSiblingIndex;
  ulbCodes?: Map<string, string>;
}) {
  return (
    <div className="flex min-w-28 flex-col items-start gap-1">
      <span className="font-mono text-xs font-medium tabular-nums">{formatRegistryParcelNo(row.parcelNo)}</span>
      <QcParcelDuplicateBadge row={row} siblingIndex={siblingIndex} ulbCodes={ulbCodes} />
    </div>
  );
}

/** Review panel only — shows parcel · unit · use composite line. */
function QcRegistrySlotCell({ row, propertyUses }: { row: ParcelSiblingRow; propertyUses?: MasterOption[] }) {
  return (
    <span className="font-mono text-xs leading-snug text-foreground">{formatRegistrySlotLabel(row, propertyUses)}</span>
  );
}
