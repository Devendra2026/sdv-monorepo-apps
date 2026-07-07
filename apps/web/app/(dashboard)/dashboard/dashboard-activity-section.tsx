import { DashboardActivityFallback } from "@/app/(dashboard)/dashboard/dashboard-activity-fallback"
import { DashboardActivityPreloaded } from "@/app/(dashboard)/dashboard/dashboard-activity-preloaded"
import { isPreloadSkippableError, preloadDashboardActivity } from "@/lib/convex-server"

export async function DashboardActivitySection() {
  try {
    const preloadedActivity = await preloadDashboardActivity()
    return <DashboardActivityPreloaded preloadedActivity={preloadedActivity} />
  } catch (error) {
    if (!isPreloadSkippableError(error)) {
      console.error("[dashboard] activity preload failed", error)
    }
    return <DashboardActivityFallback />
  }
}
