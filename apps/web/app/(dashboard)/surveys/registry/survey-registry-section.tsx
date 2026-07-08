import { SurveyRegistryClient } from "@/app/(dashboard)/surveys/registry/survey-registry-client"
import { SurveyRegistryFallback } from "@/app/(dashboard)/surveys/registry/survey-registry-fallback"
import { isPreloadSkippableError, preloadSurveyRegistryPage } from "@/lib/convex-server"

export async function SurveyRegistrySection({ nowMs }: { nowMs: number }) {
  try {
    const preloadedRegistry = await preloadSurveyRegistryPage(nowMs)
    return <SurveyRegistryClient nowMs={nowMs} preloadedRegistry={preloadedRegistry} />
  } catch (error) {
    if (!isPreloadSkippableError(error)) {
      console.error("[surveys] registry preload failed", error)
    }
    return <SurveyRegistryFallback nowMs={nowMs} />
  }
}
