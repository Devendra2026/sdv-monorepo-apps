"use client"

import { DashboardAnalyticsClient } from "@/app/(dashboard)/dashboard/dashboard-analytics-client"
import { DashboardAnalyticsSkeleton, DashboardKpisSkeleton } from "@/app/(dashboard)/dashboard/dashboard-skeleton"
import { DashboardKpiGrid } from "@/components/dashboard/dashboard-kpi-grid"
import { DashboardQcOperations } from "@/components/dashboard/dashboard-qc-operations"
import { DataSection } from "@/components/shared/data-section"
import { useDashboardAnalytics, useDashboardCounts, useDashboardQcSupervisors } from "@/hooks/analytics/useAnalytics"
import { useClientNowMs } from "@/hooks/use-client-now"
import { useConvexAuthReady } from "@/hooks/use-convex-auth-ready"
import { api } from "@workspace/backend/convex/_generated/api.js"
import type { Preloaded } from "convex/react"
import { useQuery } from "convex/react"

function DashboardAnalyticsWithPreloadedQc({
  analytics,
  preloadedQcSupervisors,
}: {
  analytics: ReturnType<typeof useDashboardAnalytics> | null
  preloadedQcSupervisors: Preloaded<typeof api.analytics.queries.qcSupervisorBundle>
}) {
  const qcSupervisors = useDashboardQcSupervisors(preloadedQcSupervisors)
  return <DashboardAnalyticsClient analytics={analytics} qcSupervisors={qcSupervisors ?? null} />
}

function DashboardAnalyticsWithQueriedQc({
  analytics,
}: {
  analytics: ReturnType<typeof useDashboardAnalytics> | null
}) {
  const ready = useConvexAuthReady()
  const nowMs = useClientNowMs()
  const qcSupervisors = useQuery(api.analytics.queries.qcSupervisorBundle, ready ? { nowMs, trendDays: 30 } : "skip")
  return <DashboardAnalyticsClient analytics={analytics} qcSupervisors={qcSupervisors ?? null} />
}

export function DashboardHomeClient({
  preloadedCounts,
  preloadedAnalytics,
  preloadedQcSupervisors,
}: {
  preloadedCounts: Preloaded<typeof api.analytics.queries.counts>
  preloadedAnalytics: Preloaded<typeof api.analytics.queries.analyticsBundle>
  preloadedQcSupervisors?: Preloaded<typeof api.analytics.queries.qcSupervisorBundle>
}) {
  const counts = useDashboardCounts(preloadedCounts)
  const analytics = useDashboardAnalytics(preloadedAnalytics)

  return (
    <div className="space-y-6 lg:space-y-8">
      <DataSection ready={counts !== undefined} skeleton={<DashboardKpisSkeleton />} ariaLabel="KPI metrics">
        <div className="space-y-6">
          <DashboardKpiGrid counts={counts!} />
          <DashboardQcOperations counts={counts!} />
        </div>
      </DataSection>

      <DataSection ready={analytics !== undefined} skeleton={<DashboardAnalyticsSkeleton />} ariaLabel="Analytics">
        {preloadedQcSupervisors ? (
          <DashboardAnalyticsWithPreloadedQc
            analytics={analytics ?? null}
            preloadedQcSupervisors={preloadedQcSupervisors}
          />
        ) : (
          <DashboardAnalyticsWithQueriedQc analytics={analytics ?? null} />
        )}
      </DataSection>
    </div>
  )
}
