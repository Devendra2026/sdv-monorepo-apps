"use client"

import { EMPTY_QC_SCOPE, type QcActionBarProps } from "@/components/qc/qc-action-bar.types"
import { useDecide, useReopen } from "@/hooks/qc/useQc"
import { useRemoveSurvey } from "@/hooks/surveys/useSurveys"
import { parseConvexError } from "@/lib/errors"
import { buildNextQcHref } from "@/lib/qc/qc-nav"
import { qcPerfMark, qcPerfMeasure } from "@/lib/qc/qc-perf"
import { scopeFromSurveyRow } from "@/lib/qc/work-scope"
import { toast } from "@workspace/ui/components/sonner"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function useQcActionBar({
  survey,
  nextSurvey,
  scope = EMPTY_QC_SCOPE,
  mode = "review",
  correctionsSaved = false,
  onSave,
  saving = false,
  onCorrectionsSaved,
}: QcActionBarProps) {
  const router = useRouter()
  const decide = useDecide()
  const reopen = useReopen()
  const removeSurvey = useRemoveSurvey()

  const [busy, setBusy] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const isApproved = survey.qcStatus === "approved"
  const isPending = survey.qcStatus === "pending" && survey.status === "submitted"
  const isDraft = survey.status === "draft"
  const canApprove = isPending && (mode === "review" || correctionsSaved)
  const isWorking = busy || saving
  const propertyLabel = survey.propertyId || `Parcel ${survey.parcelNo}`

  function advanceToNextQc() {
    if (nextSurvey) {
      router.push(buildNextQcHref(nextSurvey._id, scopeFromSurveyRow(nextSurvey)))
      return
    }
    const wardLabel = scope.wardNo ? `Ward ${scope.wardNo}` : "this ward"
    toast.info(`QC complete for ${wardLabel}. Select another ward to continue.`)
    router.push("/qc")
  }

  async function runAction(fn: () => Promise<unknown>, successMessage: string, after?: () => void) {
    setBusy(true)
    try {
      await fn()
      toast.success(successMessage)
      after?.()
    } catch (e) {
      toast.error(parseConvexError(e).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleSave() {
    if (!onSave) return
    setBusy(true)
    try {
      const ok = await onSave()
      if (ok !== false) {
        toast.success("Corrections saved")
        onCorrectionsSaved?.()
      }
    } catch (e) {
      toast.error(parseConvexError(e).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleApprove() {
    if (!canApprove) return
    setBusy(true)
    const startMark = "qc.approve.start"
    const endMark = "qc.approve.end"
    qcPerfMark(startMark)
    try {
      await decide({ surveyId: survey._id, decision: "approve" })
      qcPerfMark(endMark)
      qcPerfMeasure("qc.approve.roundtrip", startMark, endMark)
      toast.success("Survey approved — opening next QC")
      advanceToNextQc()
    } catch (e) {
      toast.error(parseConvexError(e).message)
    } finally {
      setBusy(false)
    }
  }

  async function handleReopen() {
    await runAction(
      () => reopen({ surveyId: survey._id }),
      "Survey reopened for review",
      () => {
        router.push(`/qc/${survey._id}/edit`)
      }
    )
  }

  async function handleDelete() {
    await runAction(
      () => removeSurvey({ id: survey._id }),
      "Survey deleted",
      () => router.push("/qc")
    )
  }

  return {
    survey,
    mode,
    scope,
    isApproved,
    isPending,
    isDraft,
    canApprove,
    isWorking,
    saving,
    propertyLabel,
    correctionsSaved,
    deleteOpen,
    setDeleteOpen,
    handleSave,
    handleApprove,
    handleReopen,
    handleDelete,
  }
}
