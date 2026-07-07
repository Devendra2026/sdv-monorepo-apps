import { SurveyDetailSection } from "@/app/(dashboard)/surveys/[id]/survey-detail-section"
import { SurveyPageSkeleton } from "@/components/shared/survey-route-skeleton"
import { Suspense } from "react"

export default async function SurveyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <Suspense fallback={<SurveyPageSkeleton variant="detail" />}>
      <SurveyDetailSection id={id} />
    </Suspense>
  )
}
