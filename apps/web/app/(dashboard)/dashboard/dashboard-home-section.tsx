import { DashboardHomeClient } from "@/app/(dashboard)/dashboard/dashboard-home-client"
import { DashboardHomeFallback } from "@/app/(dashboard)/dashboard/dashboard-home-fallback"
import { isPreloadSkippableError, preloadDashboardAnalytics, preloadDashboardCounts } from "@/lib/convex-server"

export async function DashboardHomeSection({ nowMs }: { nowMs: number }) {
  try {
    const [preloadedCounts, preloadedAnalytics] = await Promise.all([
      preloadDashboardCounts(nowMs),
      preloadDashboardAnalytics(nowMs),
    ])
    return <DashboardHomeClient preloadedCounts={preloadedCounts} preloadedAnalytics={preloadedAnalytics} />
  } catch (error) {
    if (!isPreloadSkippableError(error)) {
      console.error("[dashboard] home section preload failed", error)
    }
    return <DashboardHomeFallback nowMs={nowMs} />
  }
}
