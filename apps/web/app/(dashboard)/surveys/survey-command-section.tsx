import { SurveyCommandClient } from "@/app/(dashboard)/surveys/survey-command-client"
import { SurveyCommandFallback } from "@/app/(dashboard)/surveys/survey-command-fallback"
import { isPreloadSkippableError, preloadSurveyCommandCenter } from "@/lib/convex-server"

export async function SurveyCommandSection({ nowMs }: { nowMs: number }) {
  try {
    const preloadedStats = await preloadSurveyCommandCenter(nowMs)
    return <SurveyCommandClient nowMs={nowMs} preloadedStats={preloadedStats} />
  } catch (error) {
    if (!isPreloadSkippableError(error)) {
      console.error("[surveys] command preload failed", error)
    }
    return <SurveyCommandFallback nowMs={nowMs} />
  }
}
