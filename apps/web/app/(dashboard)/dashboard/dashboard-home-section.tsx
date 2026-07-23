import { DashboardHomeClient } from "@/app/(dashboard)/dashboard/dashboard-home-client"
import { DashboardHomeFallback } from "@/app/(dashboard)/dashboard/dashboard-home-fallback"
import {
  isPreloadSkippableError,
  preloadDashboardAnalytics,
  preloadDashboardCounts,
  preloadDashboardQcSupervisors,
} from "@/lib/convex-server"

/** Lighter SSR trend window — matches DashboardContent. */
const SSR_TREND_DAYS = 14

export async function DashboardHomeSection({ nowMs }: { nowMs: number }) {
  // Serialize analytics → QC (same contention avoidance as DashboardContent).
  const countsResult = await preloadDashboardCounts(nowMs).then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason: unknown) => ({ status: "rejected" as const, reason })
  )
  const analyticsResult = await preloadDashboardAnalytics(nowMs, SSR_TREND_DAYS).then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason: unknown) => ({ status: "rejected" as const, reason })
  )
  const qcResult = await preloadDashboardQcSupervisors(nowMs, SSR_TREND_DAYS).then(
    (value) => ({ status: "fulfilled" as const, value }),
    (reason: unknown) => ({ status: "rejected" as const, reason })
  )

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
