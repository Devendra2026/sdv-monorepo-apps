"use client"

import { EmptyState } from "@/components/shared/empty-state"
import { CardsSkeleton } from "@/components/shared/loading"
import { RoleGate } from "@/components/shared/role-gate"
import { useSurvey } from "@/hooks/surveys/useSurveys"
import { Skeleton } from "@workspace/ui/components/skeleton"
import dynamic from "next/dynamic"
import { use } from "react"

const DemandNoticeView = dynamic(() => import("@/components/qc/demand-notice-view").then((m) => m.DemandNoticeView), {
  ssr: false,
  loading: () => <Skeleton className="mx-auto h-[650px] max-w-5xl rounded-2xl" />,
})

function DemandNoticeContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const survey = useSurvey(id)

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

  return <DemandNoticeView survey={survey} surveyId={id} />
}

export default function DemandNoticePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <RoleGate
      mode="page"
      anyOf={["reports.export", "qc.review"]}
      deniedDescription="Demand notices are available to supervisors and administrators with report access."
    >
      <DemandNoticeContent params={params} />
    </RoleGate>
  )
}
