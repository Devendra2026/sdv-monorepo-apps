"use client"

import { DashboardAnalyticsClient } from "@/app/(dashboard)/dashboard/dashboard-analytics-client"
import { DashboardAnalyticsSkeleton, DashboardKpisSkeleton } from "@/app/(dashboard)/dashboard/dashboard-skeleton"
import { DashboardKpiGrid } from "@/components/dashboard/dashboard-kpi-grid"
import { DashboardQcOperations } from "@/components/dashboard/dashboard-qc-operations"
import { DataSection } from "@/components/shared/data-section"
import { useDashboardAnalytics, useDashboardCounts } from "@/hooks/analytics/useAnalytics"
import { api } from "@workspace/backend/convex/_generated/api.js"
import type { Preloaded } from "convex/react"

export function DashboardHomeClient({
  preloadedCounts,
  preloadedAnalytics,
}: {
  preloadedCounts: Preloaded<typeof api.analytics.queries.counts>
  preloadedAnalytics: Preloaded<typeof api.analytics.queries.analyticsBundle>
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
        <DashboardAnalyticsClient analytics={analytics ?? null} />
      </DataSection>
    </div>
  )
}
