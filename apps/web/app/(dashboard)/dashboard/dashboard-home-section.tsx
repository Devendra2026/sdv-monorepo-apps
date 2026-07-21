import { DashboardHomeClient } from "@/app/(dashboard)/dashboard/dashboard-home-client"
import { DashboardHomeFallback } from "@/app/(dashboard)/dashboard/dashboard-home-fallback"
import {
  isPreloadSkippableError,
  preloadDashboardAnalytics,
  preloadDashboardCounts,
  preloadDashboardQcSupervisors,
} from "@/lib/convex-server"

export async function DashboardHomeSection({ nowMs }: { nowMs: number }) {
  const [countsResult, analyticsResult, qcResult] = await Promise.allSettled([
    preloadDashboardCounts(nowMs),
    preloadDashboardAnalytics(nowMs),
    preloadDashboardQcSupervisors(nowMs),
  ])

  if (countsResult.status === "rejected" && !isPreloadSkippableError(countsResult.reason)) {
    console.error("[dashboard] home counts preload failed", countsResult.reason)
  }
  if (analyticsResult.status === "rejected" && !isPreloadSkippableError(analyticsResult.reason)) {
    console.error("[dashboard] home analytics preload failed", analyticsResult.reason)
  }
  if (qcResult.status === "rejected" && !isPreloadSkippableError(qcResult.reason)) {
    console.error("[dashboard] home QC supervisors preload failed", qcResult.reason)
  }

  if (countsResult.status === "fulfilled" && analyticsResult.status === "fulfilled") {
    return (
      <DashboardHomeClient
        preloadedCounts={countsResult.value}
        preloadedAnalytics={analyticsResult.value}
        preloadedQcSupervisors={qcResult.status === "fulfilled" ? qcResult.value : undefined}
      />
    )
  }

  return <DashboardHomeFallback nowMs={nowMs} />
}
