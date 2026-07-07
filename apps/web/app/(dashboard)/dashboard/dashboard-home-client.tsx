"use client"

import { DashboardAnalyticsClient } from "@/app/(dashboard)/dashboard/dashboard-analytics-client"
import { DashboardAnalyticsSkeleton, DashboardKpisSkeleton } from "@/app/(dashboard)/dashboard/dashboard-skeleton"
import { DashboardKpiGrid } from "@/components/dashboard/dashboard-kpi-grid"
import { DashboardQcOperations } from "@/components/dashboard/dashboard-qc-operations"
import { DataSection } from "@/components/shared/data-section"
import { useDashboardHomeBundle } from "@/hooks/analytics/useAnalytics"
import { api } from "@workspace/backend/convex/_generated/api.js"
import type { Preloaded } from "convex/react"

export function DashboardHomeClient({
  preloadedHome,
}: {
  preloadedHome: Preloaded<typeof api.analytics.queries.homeBundle>
}) {
  const bundle = useDashboardHomeBundle(preloadedHome)

  return (
    <div className="space-y-6 lg:space-y-8">
      <DataSection ready={bundle !== undefined} skeleton={<DashboardKpisSkeleton />} ariaLabel="KPI metrics">
        <div className="space-y-6">
          <DashboardKpiGrid counts={bundle!.counts} />
          <DashboardQcOperations counts={bundle!.counts} />
        </div>
      </DataSection>

      <DataSection ready={bundle !== undefined} skeleton={<DashboardAnalyticsSkeleton />} ariaLabel="Analytics">
        <DashboardAnalyticsClient analytics={bundle?.analytics ?? null} />
      </DataSection>
    </div>
  )
}
