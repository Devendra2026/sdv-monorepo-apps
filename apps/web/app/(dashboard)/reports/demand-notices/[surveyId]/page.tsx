"use client"

import { DemandNoticeView } from "@/components/qc/demand-notice-view"
import { EmptyState } from "@/components/shared/empty-state"
import { CardsSkeleton } from "@/components/shared/loading"
import { RoleGate } from "@/components/shared/role-gate"
import { useSurvey } from "@/hooks/surveys/useSurveys"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { use } from "react"

export default function ReportsDemandNoticePage({ params }: { params: Promise<{ surveyId: string }> }) {
  const { surveyId } = use(params)
  const survey = useSurvey(surveyId)

  if (survey === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-44 rounded-xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <CardsSkeleton count={5} />
        <Skeleton className="mx-auto h-180 max-w-5xl rounded-2xl" />
      </div>
    )
  }

  if (survey === null) return <EmptyState title="Survey not found" />

  if (survey.qcStatus !== "approved") {
    return (
      <EmptyState
        title="Demand notice unavailable"
        description="This property has not been QC-approved yet. Only approved survey assessments can generate demand notices."
      />
    )
  }

  return (
    <RoleGate
      mode="page"
      anyOf={["reports.export", "qc.review"]}
      deniedDescription="Demand notices are available to supervisors and administrators with report access."
    >
      <DemandNoticeView survey={survey} surveyId={surveyId} backHref="/reports/demand-notices" />
    </RoleGate>
  )
}
