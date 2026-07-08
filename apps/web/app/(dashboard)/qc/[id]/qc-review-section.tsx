import { QcReviewClient, QcReviewFallback } from "@/app/(dashboard)/qc/[id]/qc-review-client"
import { isPreloadSkippableError, preloadSurveyDetail } from "@/lib/convex-server"
import type { Id } from "@workspace/backend/convex/_generated/dataModel.js"

export async function QcReviewSection({ id }: { id: string }) {
  try {
    const preloadedSurvey = await preloadSurveyDetail(id as Id<"surveys">)
    return <QcReviewClient id={id} preloadedSurvey={preloadedSurvey} />
  } catch (error) {
    if (!isPreloadSkippableError(error)) {
      console.error("[qc] review preload failed", error)
    }
    return <QcReviewFallback id={id} />
  }
}
