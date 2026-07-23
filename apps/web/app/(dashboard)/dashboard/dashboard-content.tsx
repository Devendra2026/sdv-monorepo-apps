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

/** Lighter SSR trend window — client can still request 30 days via live query if needed. */
const SSR_TREND_DAYS = 14

export async function DashboardContent({ nowMs }: { nowMs: number }) {
  // Counts + activity are lighter; run in parallel with the heavy analytics chain.
  // Serialize analytics → QC to avoid SQLite queryStreamNext contention / SystemTimeout
  // from four heavy preloads hitting the self-hosted isolate at once.
  const [countsResult, activityResult, analyticsThenQc] = await Promise.all([
    preloadDashboardCounts(nowMs).then(
      (value) => ({ status: "fulfilled" as const, value }),
      (reason: unknown) => ({ status: "rejected" as const, reason })
    ),
    preloadDashboardActivity().then(
      (value) => ({ status: "fulfilled" as const, value }),
      (reason: unknown) => ({ status: "rejected" as const, reason })
    ),
    (async () => {
      const analyticsResult = await preloadDashboardAnalytics(nowMs, SSR_TREND_DAYS).then(
        (value) => ({ status: "fulfilled" as const, value }),
        (reason: unknown) => ({ status: "rejected" as const, reason })
      )
      const qcResult = await preloadDashboardQcSupervisors(nowMs, SSR_TREND_DAYS).then(
        (value) => ({ status: "fulfilled" as const, value }),
        (reason: unknown) => ({ status: "rejected" as const, reason })
      )
      return { analyticsResult, qcResult }
    })(),
  ])

  const { analyticsResult, qcResult } = analyticsThenQc

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
