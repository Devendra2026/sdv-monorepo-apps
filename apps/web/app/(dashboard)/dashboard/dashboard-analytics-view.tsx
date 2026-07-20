"use client"

import { CoverageChart, MunicipalityPerformanceCard } from "@/components/analytics/charts"
import { DashboardEmptyState } from "@/components/dashboard/dashboard-empty-state"
import { OrganizationOverview } from "@/components/dashboard/organization-overview"
import { SurveyTrendChart } from "@/components/dashboard/survey-trend-chart"
import { SurveyorProductivity, type SurveyorProductivityRow } from "@/components/dashboard/surveyor-productivity"
import { SectionHeader } from "@/components/design-system/executive-hero"
import type { WebDashboardAnalytics, WebDashboardQcSupervisors } from "@workspace/schemas"
import { Card, CardContent } from "@workspace/ui/components/card"
import { ShieldCheck } from "lucide-react"
import { useMemo } from "react"

function QcSupervisorThroughput({
  supervisors,
}: {
  supervisors: NonNullable<WebDashboardAnalytics["breakdown"]>["byQcSupervisor"]
}) {
  const topSupervisors = useMemo(
    () => [...(supervisors ?? [])].sort((a, b) => b.total - a.total).slice(0, 5),
    [supervisors]
  )

  if (topSupervisors.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          QC Supervisor Throughput
        </h3>
      </div>
      <ul className="space-y-2" role="list">
        {topSupervisors.map((supervisor, index) => (
          <li key={supervisor.reviewerId} className="flex items-center justify-between gap-3 text-sm">
            <div className="flex min-w-0 items-center gap-2">
              <span className="w-5 shrink-0 text-xs font-medium text-muted-foreground tabular-nums">#{index + 1}</span>
              <span className="truncate font-medium text-foreground">{supervisor.name}</span>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground tabular-nums">
              <span className="text-emerald-600 dark:text-emerald-400">{supervisor.approved} approved</span>
              <span className="text-destructive">{supervisor.rejected} rejected</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function DashboardAnalyticsView({
  analytics,
  qcSupervisors,
}: {
  analytics: WebDashboardAnalytics | null
  qcSupervisors?: WebDashboardQcSupervisors | null
}) {
  const surveyorRows = useMemo((): SurveyorProductivityRow[] => {
    if (!analytics?.breakdown?.bySurveyor) return []
    return [...analytics.breakdown.bySurveyor]
      .map((s) => ({
        name: s.name,
        submitted: s.submitted,
        approved: s.approved,
      }))
      .sort((a, b) => b.submitted - a.submitted || b.approved - a.approved)
      .slice(0, 8)
  }, [analytics?.breakdown?.bySurveyor])

  const wardCoverageData = useMemo(
    () =>
      analytics?.wardCoverage?.map((w) => ({
        wardNo: w.wardNo,
        municipalityName: w.municipalityName,
        total: w.total,
        approvalRate: w.approvalRate,
      })),
    [analytics?.wardCoverage]
  )

  const municipalityItems = useMemo(
    () =>
      analytics?.breakdown?.byUlb?.map((m) => ({
        id: m.municipalityId,
        name: m.name,
        approved: m.approved,
        total: m.total,
      })),
    [analytics?.breakdown?.byUlb]
  )

  const mergedBreakdown = useMemo(() => {
    if (!analytics?.breakdown) return analytics?.breakdown
    if (!qcSupervisors) return analytics.breakdown
    return {
      ...analytics.breakdown,
      byQcSupervisor: qcSupervisors.byQcSupervisor,
      filterOptions: {
        ...analytics.breakdown.filterOptions,
        qcSupervisors: qcSupervisors.qcSupervisors,
      },
    }
  }, [analytics?.breakdown, qcSupervisors])

  if (analytics === null) {
    return (
      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardContent className="p-4">
          <DashboardEmptyState
            compact
            title="Analytics unavailable"
            description="Analytics charts are not available for your role. KPIs and recent activity reflect your assigned scope."
          />
        </CardContent>
      </Card>
    )
  }

  const { dailyTrend } = analytics

  return (
    <div className="space-y-6">
      {mergedBreakdown ? <OrganizationOverview breakdown={mergedBreakdown} /> : null}

      <section aria-labelledby="analytics-heading" className="space-y-4">
        <SectionHeader
          id="analytics-heading"
          title="Productivity Analytics"
          description="30-day trends and team performance"
        />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SurveyTrendChart data={dailyTrend} />
          </div>
          <SurveyorProductivity data={surveyorRows} />
        </div>
        <QcSupervisorThroughput supervisors={mergedBreakdown?.byQcSupervisor ?? []} />
      </section>

      <section aria-labelledby="coverage-heading" className="space-y-4">
        <SectionHeader id="coverage-heading" title="Coverage" description="Ward-level survey coverage" />
        <CoverageChart data={wardCoverageData} title="Ward Coverage Detail" />
        <MunicipalityPerformanceCard items={municipalityItems} />
      </section>
    </div>
  )
}
