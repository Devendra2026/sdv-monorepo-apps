"use client"

import { QcConflictPanel, type QcConflictRow } from "@/components/qc/qc-conflict-panel"
import { usePropertyIdConflicts } from "@/hooks/qc/useQc"
import { QC_DUPLICATE_BADGE } from "@/lib/design-system"
import { cn } from "@workspace/ui/lib/utils"
import { AlertTriangle } from "lucide-react"
import { useMemo } from "react"

const DUPLICATE_REJECT_COMMENT =
  "Duplicate Property ID — reject this record or correct ward, parcel, unit, or property use with the field team."

export function QcPropertyIdConflictPanel({ surveyId, propertyId }: { surveyId: string; propertyId?: string }) {
  const conflicts = usePropertyIdConflicts(surveyId)
  if (conflicts === undefined) return null
  if (conflicts.length === 0) return null

  const rows: QcConflictRow[] = useMemo(() => conflicts as unknown as QcConflictRow[], [conflicts])

  return (
    <QcConflictPanel
      variant="propertyId"
      title={`Duplicate Property ID${propertyId ? `: ${propertyId}` : ""}`}
      description="Another survey already uses this Property ID. Saves will fail until you reject the duplicate or change ward, parcel, unit, or property use on one record."
      icon={<AlertTriangle className="h-4 w-4 text-red-600" aria-hidden />}
      alertText="Compare owner, photos, and GPS with the conflicting record below. Keep the correct survey and reject or renumber the other."
      cardClassName={cn("border-red-500/35", QC_DUPLICATE_BADGE.conflictPanel)}
      rows={rows}
      rejectComment={DUPLICATE_REJECT_COMMENT}
      taggedSections={["property"]}
    />
  )
}
