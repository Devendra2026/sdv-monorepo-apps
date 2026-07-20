import { DashboardActivityFallback } from "@/app/(dashboard)/dashboard/dashboard-activity-fallback"
import { DashboardActivityPreloaded } from "@/app/(dashboard)/dashboard/dashboard-activity-preloaded"
import { DashboardHomeClient } from "@/app/(dashboard)/dashboard/dashboard-home-client"
import { DashboardHomeFallback } from "@/app/(dashboard)/dashboard/dashboard-home-fallback"
import {
  isPreloadSkippableError,
  preloadDashboardActivity,
  preloadDashboardAnalytics,
  preloadDashboardCounts,
  preloadDashboardQcSupervisors,
} from "@/lib/convex-server"

export async function DashboardContent({ nowMs }: { nowMs: number }) {
  const [countsResult, analyticsResult, qcResult, activityResult] = await Promise.allSettled([
    preloadDashboardCounts(nowMs),
    preloadDashboardAnalytics(nowMs),
    preloadDashboardQcSupervisors(nowMs),
    preloadDashboardActivity(),
  ])

  if (countsResult.status === "rejected" && !isPreloadSkippableError(countsResult.reason)) {
    console.error("[dashboard] counts preload failed", countsResult.reason)
  }
  if (analyticsResult.status === "rejected" && !isPreloadSkippableError(analyticsResult.reason)) {
    console.error("[dashboard] analytics preload failed", analyticsResult.reason)
  }
  if (qcResult.status === "rejected" && !isPreloadSkippableError(qcResult.reason)) {
    console.error("[dashboard] QC supervisors preload failed", qcResult.reason)
  }

  const homeSection =
    countsResult.status === "fulfilled" && analyticsResult.status === "fulfilled" ? (
      <DashboardHomeClient
        preloadedCounts={countsResult.value}
        preloadedAnalytics={analyticsResult.value}
        preloadedQcSupervisors={qcResult.status === "fulfilled" ? qcResult.value : undefined}
      />
    ) : (
      <DashboardHomeFallback nowMs={nowMs} />
    )

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
