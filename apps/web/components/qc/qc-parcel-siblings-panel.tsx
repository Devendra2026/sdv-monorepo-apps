"use client"

import { QcConflictPanel, type QcConflictRow } from "@/components/qc/qc-conflict-panel"
import { useParcelSiblings } from "@/hooks/qc/useQc"
import { QC_DUPLICATE_BADGE } from "@/lib/design-system"
import { detectParcelConflict, type ParcelSiblingRow } from "@/lib/qc/parcel-siblings"
import { formatRegistryParcelNo, formatRegistryWardNo } from "@/lib/survey/format-registry-parcel"
import { cn } from "@workspace/ui/lib/utils"
import { AlertTriangle } from "lucide-react"
import { useMemo } from "react"

const DUPLICATE_REJECT_COMMENT =
  "Duplicate parcel entry — please reassign parcel number or correct property use with field team."

export function QcParcelSiblingsPanel({
  surveyId,
  wardNo,
  parcelNo,
  currentSurvey,
}: {
  surveyId: string
  wardNo: string
  parcelNo: string
  currentSurvey: ParcelSiblingRow
}) {
  const siblings = useParcelSiblings(surveyId)

  const allOnParcel = useMemo(() => {
    if (!siblings) return undefined
    return [currentSurvey, ...siblings]
  }, [siblings, currentSurvey])

  const tableRows = useMemo((): QcConflictRow[] => {
    if (!siblings) return []
    return [{ ...currentSurvey, isCurrent: true }, ...siblings.map((s) => ({ ...s, isCurrent: false }))]
  }, [siblings, currentSurvey])

  const hasConflict = useMemo(() => {
    if (!allOnParcel) return false
    return detectParcelConflict(allOnParcel)
  }, [allOnParcel])

  if (siblings === undefined) return null
  if (siblings.length === 0) return null

  const description = hasConflict
    ? "Multiple pending records share this parcel and unit with different owners — review each or return duplicates."
    : "Different property uses on the same parcel are valid when each use type is correct on site."

  return (
    <QcConflictPanel
      variant="parcel"
      title={`Other records on Ward ${formatRegistryWardNo(wardNo)} · Parcel ${formatRegistryParcelNo(parcelNo)}`}
      description={description}
      icon={<AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />}
      alertText={
        hasConflict
          ? "Likely field numbering overlap — compare photos and GPS before approving both records."
          : undefined
      }
      cardClassName={cn("border-amber-500/30", QC_DUPLICATE_BADGE.conflictPanel)}
      rows={tableRows}
      rejectComment={DUPLICATE_REJECT_COMMENT}
      taggedSections={["property"]}
    />
  )
}
