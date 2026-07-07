"use client"

import { TrendChart } from "@/components/analytics/trend-chart"
import { DashboardEmptyState } from "@/components/dashboard/dashboard-empty-state"
import type { DailyTrendPoint } from "@workspace/schemas/analytics"
import { LineChart } from "lucide-react"

export function SurveyTrendChart({ data }: { data: DailyTrendPoint[] | undefined }) {
  const isEmpty =
    !data || data.length === 0 || data.every((d) => d.created === 0 && d.approved === 0 && d.rejected === 0)

  if (isEmpty) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">Daily Survey &amp; Approval Trend</h3>
          <p className="text-xs text-muted-foreground">Created vs approved vs rejected over time</p>
        </div>
        <div className="p-4">
          <DashboardEmptyState
            compact
            icon={LineChart}
            title="No survey activity yet"
            description="Survey activity and approval trends will appear here once surveys are submitted."
          />
        </div>
      </div>
    )
  }

  return <TrendChart data={data} title="Daily Survey & Approval Trend" />
}
