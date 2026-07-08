"use client"

import { EmptyState } from "@/components/shared/empty-state"
import { CardsSkeleton } from "@/components/shared/loading"
import { RoleGate } from "@/components/shared/role-gate"
import { useSurvey } from "@/hooks/surveys/useSurveys"
import { Skeleton } from "@workspace/ui/components/skeleton"
import dynamic from "next/dynamic"
import { use } from "react"

const QcFinalReportView = dynamic(
  () => import("@/components/qc/qc-final-report-view").then((m) => m.QcFinalReportView),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[700px] w-full rounded-2xl" />,
  }
)

function QcFinalReportContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const survey = useSurvey(id)

  if (survey === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-40 rounded-xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <CardsSkeleton count={5} />
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-80 w-full rounded-2xl" />
          </div>
          <div className="space-y-5">
            <Skeleton className="h-72 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    )
  }

  if (survey === null) return <EmptyState title="Survey not found" />

  return <QcFinalReportView survey={survey} surveyId={id} />
}

export default function QcFinalReportPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <RoleGate
      mode="page"
      capability="qc.review"
      deniedDescription="QC final reports are available to supervisors and administrators."
    >
      <QcFinalReportContent params={params} />
    </RoleGate>
  )
}
