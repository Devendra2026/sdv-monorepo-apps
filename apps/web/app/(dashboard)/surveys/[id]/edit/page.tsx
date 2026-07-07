"use client"

import { PageTransition } from "@/components/design-system/motion"
import { QcCorrectionBanner } from "@/components/qc/qc-correction-banner"
import { EmptyState } from "@/components/shared/empty-state"
import { RoleGate } from "@/components/shared/role-gate"
import { SurveyEditor, type SurveySubmitArea } from "@/components/surveys/survey-editor"
import { SurveyViewHero } from "@/components/surveys/survey-view-hero"
import { useQcRemarks } from "@/hooks/qc/useQc"
import { useSubmitSurvey, useSurvey } from "@/hooks/surveys/useSurveys"
import { canSubmitSurvey, canUserEditSurvey, isSurveyAwaitingQc, isSurveyResubmit } from "@/lib/domain"
import { convexValidationSummary, toastSurveyConflict } from "@/lib/errors"
import { useCurrentUser } from "@/lib/sessions"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { ArrowLeft, Eye, PencilLine } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Suspense, use, useState } from "react"
import { toast } from "sonner"

function SurveyEditPageSkeleton() {
  return (
    <PageTransition className="space-y-6">
      <Skeleton className="h-9 w-36 rounded-xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-96 w-full rounded-2xl" />
    </PageTransition>
  )
}

function SurveyEditPageContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const survey = useSurvey(id)
  const remarks = useQcRemarks(id)
  const submitSurvey = useSubmitSurvey()
  const { role, capabilities } = useCurrentUser()
  const [submitting, setSubmitting] = useState(false)

  if (survey === undefined) {
    return <SurveyEditPageSkeleton />
  }

  if (survey === null) {
    return <EmptyState title="Survey not found" description="It may have been deleted or is outside your scope." />
  }

  const canEdit = canUserEditSurvey(survey, { role, capabilities })
  const locked = survey.qcStatus === "approved" && !canEdit
  const canSubmit = canSubmitSurvey(survey) && canEdit
  const isResubmit = isSurveyResubmit(survey)
  const awaitingQc = isSurveyAwaitingQc(survey)
  const backHref = `/surveys/${id}`

  async function onSubmit(area?: SurveySubmitArea) {
    setSubmitting(true)
    try {
      await submitSurvey({ id: id as any, ...area })
      toast.success("Survey submitted for QC")
      router.push(`/surveys/${id}`)
    } catch (e) {
      if (!toastSurveyConflict(e, { onNavigate: (href) => router.push(href) })) {
        toast.error(convexValidationSummary(e))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageTransition className="space-y-6 lg:space-y-8">
      <Button
        asChild
        variant="outline"
        size="sm"
        className="w-fit cursor-pointer rounded-xl border-border/70 bg-card/80 px-4 shadow-premium-sm backdrop-blur-sm transition-colors duration-200 hover:bg-muted/40"
      >
        <Link href={backHref}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to detail
        </Link>
      </Button>

      <SurveyViewHero
        survey={survey}
        surveyId={id}
        canEdit={false}
        title="Survey Edit"
        icon={PencilLine}
        extraActions={
          <Button
            asChild
            variant="outline"
            size="sm"
            className="cursor-pointer rounded-lg border-brand-navy/25 bg-card/80 shadow-premium-sm transition-colors duration-200 hover:bg-brand-navy/5 dark:border-primary/30"
          >
            <Link href={backHref}>
              <Eye className="h-4 w-4" aria-hidden /> View detail
            </Link>
          </Button>
        }
      />

      {locked || !canEdit ? (
        <EmptyState
          title={awaitingQc ? "Awaiting QC review" : "Survey locked"}
          description={
            awaitingQc
              ? "This survey has been submitted and is locked until QC completes verification. Contact an administrator for emergency edits."
              : "This survey has been approved and can no longer be edited. Contact an administrator to re-open it."
          }
          action={
            <Button asChild variant="outline" className="cursor-pointer rounded-xl">
              <Link href={backHref}>View detail</Link>
            </Button>
          }
        />
      ) : (
        <>
          {isResubmit && <QcCorrectionBanner remarks={remarks} />}
          <SurveyEditor
            localId={survey.localId}
            surveyId={id}
            existing={survey}
            showSaveBar={!canSubmit}
            showSubmitBar={canSubmit}
            onSubmit={onSubmit}
            submitting={submitting}
            submitLabel={isResubmit ? "Save & Re-submit to QC" : undefined}
          />
        </>
      )}
    </PageTransition>
  )
}

export default function SurveyEditPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <RoleGate mode="page" capability="surveys.editDraft" deniedDescription="You don't have permission to edit surveys.">
      <Suspense fallback={<SurveyEditPageSkeleton />}>
        <SurveyEditPageContent params={params} />
      </Suspense>
    </RoleGate>
  )
}
