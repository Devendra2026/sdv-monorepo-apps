"use client"

import { ExecutiveHero } from "@/components/design-system/executive-hero"
import { PageTransition } from "@/components/design-system/motion"
import { QcActionBar } from "@/components/qc/qc-action-bar"
import { QcCorrectionBanner } from "@/components/qc/qc-correction-banner"
import { QcPropertyIdConflictPanel } from "@/components/qc/qc-property-id-conflict-panel"
import { EmptyState } from "@/components/shared/empty-state"
import { RoleGate } from "@/components/shared/role-gate"
import { QcStatusBadge, SurveyStatusBadge } from "@/components/shared/status-badge"
import { useQcRemarks } from "@/hooks/qc/useQc"
import { useQcPendingQueue } from "@/hooks/qc/useQcPendingQueue"
import { useQcWorkScope } from "@/hooks/qc/useQcWorkScope"
import { useSurvey } from "@/hooks/surveys/useSurveys"
import { canUserEditSurvey, isSurveyAwaitingQc, isSurveyResubmit } from "@/lib/domain"
import { findNextPendingSurvey } from "@/lib/qc/queue-nav"
import { scopeFromSurveyRow } from "@/lib/qc/work-scope"
import { useCurrentUser } from "@/lib/sessions"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { ArrowLeft, ClipboardCheck } from "lucide-react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, use, useEffect, useMemo, useRef, useState } from "react"

const SurveyEditor = dynamic(() => import("@/components/surveys/survey-editor").then((m) => m.SurveyEditor), {
  ssr: false,
  loading: () => <Skeleton className="h-[500px] w-full rounded-2xl" />,
})

function QcEditPageSkeleton() {
  return (
    <PageTransition className="space-y-6 pb-28">
      <Skeleton className="h-9 w-36 rounded-xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-96 w-full rounded-2xl" />
    </PageTransition>
  )
}

function QcEditContent({ id }: { id: string }) {
  const survey = useSurvey(id)
  const remarks = useQcRemarks(id)
  const { role, capabilities } = useCurrentUser()
  const { patchScope } = useQcWorkScope(survey)
  const searchParams = useSearchParams()
  const wardNoFromUrl = searchParams.get("wardNo") ?? undefined
  const municipalityIdFromUrl = searchParams.get("municipalityId") ?? undefined
  const districtIdFromUrl = searchParams.get("districtId") ?? undefined
  const workScope = useMemo(() => (survey ? scopeFromSurveyRow(survey) : {}), [survey])
  const pendingQueue = useQcPendingQueue(workScope, !!survey)
  const [correctionsSaved, setCorrectionsSaved] = useState(false)
  const saveCorrectionsRef = useRef<(() => Promise<boolean>) | null>(null)

  const nextSurvey = useMemo(() => findNextPendingSurvey(pendingQueue, survey), [pendingQueue, survey])

  useEffect(() => {
    if (!wardNoFromUrl && !municipalityIdFromUrl && !districtIdFromUrl) return
    const patch: { wardNo?: string; municipalityId?: string; districtId?: string } = {}
    if (wardNoFromUrl) patch.wardNo = wardNoFromUrl
    if (municipalityIdFromUrl) patch.municipalityId = municipalityIdFromUrl
    if (districtIdFromUrl) patch.districtId = districtIdFromUrl
    patchScope(patch)
  }, [wardNoFromUrl, municipalityIdFromUrl, districtIdFromUrl, patchScope])

  if (survey === undefined) return <QcEditPageSkeleton />
  if (survey === null) {
    return <EmptyState title="Survey not found" description="It may have been deleted or is outside your scope." />
  }

  const propertyLabel = survey.propertyId || `Parcel ${survey.parcelNo}`
  const canEdit = canUserEditSurvey(survey, { role, capabilities })
  const awaitingQc = isSurveyAwaitingQc(survey)
  const isResubmit = isSurveyResubmit(survey)
  const readyToApprove = correctionsSaved

  return (
    <PageTransition className="space-y-6 pb-28 lg:space-y-8">
      <Button
        asChild
        variant="outline"
        size="sm"
        className="w-fit cursor-pointer rounded-xl border-amber-300/60 bg-card/80 px-4 shadow-premium-sm backdrop-blur-sm hover:bg-amber-500/10 dark:border-amber-700/50"
      >
        <Link href={`/qc/${id}`}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to QC review
        </Link>
      </Button>

      <ExecutiveHero
        eyebrow="QC Correction"
        title={propertyLabel}
        description={`${survey.city} · Ward ${survey.wardNo} — correct data, save, then approve to advance automatically.`}
        icon={ClipboardCheck}
        gradient="amber"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SurveyStatusBadge status={survey.status} />
            <QcStatusBadge status={survey.qcStatus} />
          </div>
        }
      />

      {!canEdit ? (
        <EmptyState
          title="Cannot edit in current state"
          description={
            survey.qcStatus === "approved"
              ? "This survey is approved and locked. Reopen it from the QC review screen if further changes are needed."
              : "This survey must be submitted before QC corrections can be applied."
          }
          action={
            <Button asChild variant="outline" className="rounded-xl">
              <Link href={`/qc/${id}`}>Return to QC review</Link>
            </Button>
          }
        />
      ) : (
        <>
          <QcPropertyIdConflictPanel surveyId={id} propertyId={survey.propertyId} />
          {isResubmit && <QcCorrectionBanner remarks={remarks} />}
          {awaitingQc && !readyToApprove && (
            <output className="block rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
              Make your corrections below, then click <strong>Save</strong> in the action bar to unlock{" "}
              <strong>Approved</strong>.
            </output>
          )}
          {awaitingQc && readyToApprove && (
            <output className="block rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-950 dark:text-emerald-100">
              Corrections are saved — click <strong>Approved</strong> to finish and move to the next survey
              automatically.
            </output>
          )}
          <SurveyEditor
            localId={survey.localId}
            surveyId={id}
            existing={survey}
            showSaveBar={false}
            showSubmitBar={false}
            conflictLinkVariant="qc"
            saveCorrectionsRef={saveCorrectionsRef}
            onDirty={() => setCorrectionsSaved(false)}
          />
          <QcActionBar
            survey={survey}
            nextSurvey={nextSurvey}
            scope={workScope}
            mode="edit"
            correctionsSaved={readyToApprove}
            onSave={async () => saveCorrectionsRef.current?.() ?? false}
            onCorrectionsSaved={() => setCorrectionsSaved(true)}
          />
        </>
      )}
    </PageTransition>
  )
}

function QcEditBody({ id }: { id: string }) {
  return (
    <RoleGate
      mode="page"
      capability="qc.review"
      deniedDescription="Quality Control editing is available to QC supervisors and administrators."
    >
      <QcEditContent id={id} />
    </RoleGate>
  )
}

export default function QcEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  return (
    <Suspense fallback={<QcEditPageSkeleton />}>
      <QcEditBody key={id} id={id} />
    </Suspense>
  )
}
