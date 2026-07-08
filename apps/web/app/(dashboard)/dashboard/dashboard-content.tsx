import { DashboardActivityFallback } from "@/app/(dashboard)/dashboard/dashboard-activity-fallback"
import { DashboardActivityPreloaded } from "@/app/(dashboard)/dashboard/dashboard-activity-preloaded"
import { DashboardHomeClient } from "@/app/(dashboard)/dashboard/dashboard-home-client"
import { DashboardHomeFallback } from "@/app/(dashboard)/dashboard/dashboard-home-fallback"
import { isPreloadSkippableError, preloadDashboardActivity, preloadDashboardHomeBundle } from "@/lib/convex-server"

export async function DashboardContent({ nowMs }: { nowMs: number }) {
  const [homeResult, activityResult] = await Promise.allSettled([
    preloadDashboardHomeBundle(nowMs),
    preloadDashboardActivity(),
  ])

  let homeSection
  if (homeResult.status === "fulfilled") {
    homeSection = <DashboardHomeClient preloadedHome={homeResult.value} />
  } else if (isPreloadSkippableError(homeResult.reason)) {
    homeSection = <DashboardHomeFallback nowMs={nowMs} />
  } else {
    console.error("[dashboard] home bundle preload failed", homeResult.reason)
    homeSection = <DashboardHomeFallback nowMs={nowMs} />
  }

  let activitySection
  if (activityResult.status === "fulfilled") {
    activitySection = <DashboardActivityPreloaded preloadedActivity={activityResult.value} />
  } else if (isPreloadSkippableError(activityResult.reason)) {
    activitySection = <DashboardActivityFallback />
  } else {
    console.error("[dashboard] activity preload failed", activityResult.reason)
    activitySection = <DashboardActivityFallback />
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      {homeSection}
      {activitySection}
    </div>
  )
}
