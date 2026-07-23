import { SurveyRegistrySection } from "@/app/(dashboard)/surveys/registry/survey-registry-section"
import { SurveyPageSkeleton } from "@/components/shared/survey-route-skeleton"
import { bucketNowMs } from "@/lib/now-ms"
import { Suspense } from "react"

export default function SurveyRegistryPage() {
  const nowMs = bucketNowMs()

  return (
    <Suspense fallback={<SurveyPageSkeleton variant="registry" />}>
      <SurveyRegistrySection nowMs={nowMs} />
    </Suspense>
  )
}
