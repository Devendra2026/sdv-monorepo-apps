"use client"

import { DashboardAnalyticsClient } from "@/app/(dashboard)/dashboard/dashboard-analytics-client"
import { DashboardAnalyticsSkeleton, DashboardKpisSkeleton } from "@/app/(dashboard)/dashboard/dashboard-skeleton"
import { DashboardKpiGrid } from "@/components/dashboard/dashboard-kpi-grid"
import { DashboardQcOperations } from "@/components/dashboard/dashboard-qc-operations"
import { DataSection } from "@/components/shared/data-section"
import { useClientNowMs } from "@/hooks/use-client-now"
import { useConvexAuthReady } from "@/hooks/use-convex-auth-ready"
import { api } from "@workspace/backend/convex/_generated/api.js"
import { useQuery } from "convex/react"

/** Client-side counts + analytics when server preload fails or user is not provisioned yet. */
export function DashboardHomeFallback({ nowMs: nowMsProp }: { nowMs?: number }) {
  const ready = useConvexAuthReady()
  const clientNowMs = useClientNowMs()
  const nowMs = nowMsProp ?? clientNowMs
  const counts = useQuery(api.analytics.queries.counts, ready ? { nowMs } : "skip")
  const analytics = useQuery(api.analytics.queries.analyticsBundle, ready ? { nowMs, trendDays: 30 } : "skip")
  const qcSupervisors = useQuery(api.analytics.queries.qcSupervisorBundle, ready ? { nowMs, trendDays: 30 } : "skip")

  return (
    <div className="space-y-6 lg:space-y-8">
      <DataSection ready={counts !== undefined} skeleton={<DashboardKpisSkeleton />} ariaLabel="KPI metrics">
        <div className="space-y-6">
          <DashboardKpiGrid counts={counts!} />
          <DashboardQcOperations counts={counts!} />
        </div>
      </DataSection>

      <DataSection ready={analytics !== undefined} skeleton={<DashboardAnalyticsSkeleton />} ariaLabel="Analytics">
        <DashboardAnalyticsClient analytics={analytics ?? null} qcSupervisors={qcSupervisors ?? null} />
      </DataSection>
    </div>
  )
}
