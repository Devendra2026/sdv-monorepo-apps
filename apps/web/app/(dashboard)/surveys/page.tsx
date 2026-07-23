import { SurveyCommandSection } from "@/app/(dashboard)/surveys/survey-command-section"
import { SurveyPageSkeleton } from "@/components/shared/survey-route-skeleton"
import { bucketNowMs } from "@/lib/now-ms"
import { Suspense } from "react"

export default function SurveyCommandCenterPage() {
  const nowMs = bucketNowMs()

  return (
    <Suspense fallback={<SurveyPageSkeleton variant="command" />}>
      <SurveyCommandSection nowMs={nowMs} />
    </Suspense>
  )
}
