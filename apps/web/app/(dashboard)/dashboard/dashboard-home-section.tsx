import { DashboardHomeClient } from "@/app/(dashboard)/dashboard/dashboard-home-client"
import { DashboardHomeFallback } from "@/app/(dashboard)/dashboard/dashboard-home-fallback"
import { isPreloadSkippableError, preloadDashboardHomeBundle } from "@/lib/convex-server"

export async function DashboardHomeSection({ nowMs }: { nowMs: number }) {
  try {
    const preloadedHome = await preloadDashboardHomeBundle(nowMs)
    return <DashboardHomeClient preloadedHome={preloadedHome} />
  } catch (error) {
    if (!isPreloadSkippableError(error)) {
      console.error("[dashboard] home bundle preload failed", error)
    }
    return <DashboardHomeFallback nowMs={nowMs} />
  }
}
