"use client"

import { GlassCard, GlassCardHeader } from "@/components/design-system/glass-card"
import { QcPropertyUseCell } from "@/components/qc/qc-registry-cells"
import { RoleGate } from "@/components/shared/role-gate"
import { QcStatusBadge } from "@/components/shared/status-badge"
import { useMasters } from "@/hooks/masters/useMasters"
import { useDecide } from "@/hooks/qc/useQc"
import { QC_DUPLICATE_BADGE, QC_TABLE } from "@/lib/design-system"
import { parseConvexError } from "@/lib/errors"
import { formatRegistryParcelNo, formatRegistryWardNo } from "@/lib/survey/format-registry-parcel"
import { buildUlbCodeMap, resolveDisplayPropertyId } from "@/lib/survey/resolve-display-property-id"
import { resolveOwnerDisplayName } from "@/lib/survey/resolve-owner-name"
import type { Id } from "@workspace/backend/convex/_generated/dataModel.js"
import type { QcSection } from "@workspace/schemas"
import { Button } from "@workspace/ui/components/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"
import { Eye, Pencil } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { useMemo, useState } from "react"
import { toast } from "sonner"

export type QcConflictRow = {
  _id: string
  municipalityId?: string
  wardNo: string
  parcelNo: string
  unitNo?: string
  propertyId?: string
  propertyUse?: string
  owners?: { name?: string }[]
  respondentName?: string
  qcStatus: "pending" | "approved" | "rejected"
  status?: string
  isCurrent?: boolean
}

export type QcConflictPanelVariant = "parcel" | "propertyId"

export type QcConflictPanelProps = {
  variant: QcConflictPanelVariant
  title: string
  description: string
  icon: ReactNode
  alertText?: string
  cardClassName: string
  rows: QcConflictRow[]
  rejectComment: string
  taggedSections: QcSection[]
}

export function QcConflictPanel({
  variant,
  title,
  description,
  icon,
  alertText,
  cardClassName,
  rows,
  rejectComment,
  taggedSections,
}: QcConflictPanelProps) {
  const decide = useDecide()
  const { masters } = useMasters()
  const ulbCodes = useMemo(() => (masters ? buildUlbCodeMap(masters.ulbs) : undefined), [masters])
  const propertyUses = masters?.propertyUses

  const [rejectingId, setRejectingId] = useState<string | null>(null)

  const handleRejectDuplicate = async (targetId: string) => {
    setRejectingId(targetId)
    try {
      await decide({
        surveyId: targetId as Id<"surveys">,
        decision: "reject",
        comment: rejectComment,
        taggedSections,
      })
      toast.success("Record returned to surveyor for correction")
    } catch (err) {
      toast.error(parseConvexError(err).message)
    } finally {
      setRejectingId(null)
    }
  }

  if (rows.length === 0) return null

  return (
    <GlassCard padding="md" className={cardClassName}>
      <GlassCardHeader title={title} description={description} icon={icon} />

      {alertText ? <p className={cn("mb-4", QC_DUPLICATE_BADGE.conflictAlert)}>{alertText}</p> : null}

      <div className="overflow-x-auto">
        <Table className="min-w-200">
          <TableHeader>
            <TableRow className={QC_TABLE.headerRow}>
              <TableHead className={QC_TABLE.headerCell}>Property ID</TableHead>
              <TableHead className={QC_TABLE.headerCell}>Ward</TableHead>
              <TableHead className={QC_TABLE.headerCell}>Parcel</TableHead>
              {variant === "propertyId" && <TableHead className={QC_TABLE.headerCell}>Unit</TableHead>}
              <TableHead className={QC_TABLE.headerCell}>Property Use</TableHead>
              <TableHead className={QC_TABLE.headerCell}>Owner</TableHead>
              <TableHead className={QC_TABLE.headerCell}>QC</TableHead>
              <TableHead className={QC_TABLE.headerCell}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row._id}
                className={cn(QC_TABLE.bodyRow, row.isCurrent && QC_DUPLICATE_BADGE.currentRowHighlight)}
              >
                <TableCell className={cn(QC_TABLE.monoCell, "py-2.5")}>
                  {resolveDisplayPropertyId(row, ulbCodes) ?? row.propertyId ?? "—"}
                  {row.isCurrent ? (
                    <span className="ml-2 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-amber-950 uppercase dark:text-amber-100">
                      Current
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="py-2.5 font-mono text-xs tabular-nums">
                  {formatRegistryWardNo(row.wardNo)}
                </TableCell>
                <TableCell className="py-2.5 font-mono text-xs tabular-nums">
                  {formatRegistryParcelNo(row.parcelNo)}
                </TableCell>
                {variant === "propertyId" ? (
                  <TableCell className="py-2.5 font-mono text-xs tabular-nums">{row.unitNo || "—"}</TableCell>
                ) : null}
                <TableCell className="py-2.5">
                  <QcPropertyUseCell propertyUse={row.propertyUse} propertyUses={propertyUses} />
                </TableCell>
                <TableCell className="py-2.5 font-medium">{resolveOwnerDisplayName(row)}</TableCell>
                <TableCell className="py-2.5">
                  <QcStatusBadge status={row.qcStatus} />
                </TableCell>
                <TableCell className="py-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {!row.isCurrent ? (
                      <>
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
                      </>
                    ) : null}

                    {row.qcStatus === "pending" && row.status === "submitted" && !row.isCurrent ? (
                      <RoleGate capability="qc.decide" fallback={null}>
                        <Button
                          size="sm"
                          variant="outline"
                          className={cn(
                            "h-7 cursor-pointer rounded-full px-2.5 text-xs",
                            QC_DUPLICATE_BADGE.rejectButton
                          )}
                          disabled={rejectingId === row._id}
                          onClick={() => void handleRejectDuplicate(row._id)}
                        >
                          Reject duplicate
                        </Button>
                      </RoleGate>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </GlassCard>
  )
}
