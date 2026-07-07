import { SurveyDetailClient, SurveyDetailFallback } from "@/app/(dashboard)/surveys/[id]/survey-detail-client"
import { isPreloadSkippableError, preloadSurveyDetail } from "@/lib/convex-server"
import type { Id } from "@workspace/backend/convex/_generated/dataModel.js"

export async function SurveyDetailSection({ id }: { id: string }) {
  try {
    const preloadedSurvey = await preloadSurveyDetail(id as Id<"surveys">)
    return <SurveyDetailClient id={id} preloadedSurvey={preloadedSurvey} />
  } catch (error) {
    if (!isPreloadSkippableError(error)) {
      console.error("[surveys] detail preload failed", error)
    }
    return <SurveyDetailFallback id={id} />
  }
}
