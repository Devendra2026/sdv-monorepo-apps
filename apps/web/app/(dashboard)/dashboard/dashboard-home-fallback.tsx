"use client"

import { DashboardAnalyticsClient } from "@/app/(dashboard)/dashboard/dashboard-analytics-client"
import { DashboardAnalyticsSkeleton, DashboardKpisSkeleton } from "@/app/(dashboard)/dashboard/dashboard-skeleton"
import { DashboardKpiGrid } from "@/components/dashboard/dashboard-kpi-grid"
import { DashboardQcOperations } from "@/components/dashboard/dashboard-qc-operations"
import { DataSection } from "@/components/shared/data-section"
import { useClientNowMs } from "@/hooks/use-client-now"
import { api } from "@workspace/backend/convex/_generated/api.js"
import { useQuery } from "convex/react"

/** Client-side home bundle subscription when server preload fails. */
export function DashboardHomeFallback() {
  const nowMs = useClientNowMs()
  const bundle = useQuery(api.analytics.queries.homeBundle, { nowMs, trendDays: 30 })

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
