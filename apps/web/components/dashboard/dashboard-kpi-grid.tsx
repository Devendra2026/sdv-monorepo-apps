"use client"

import { DashboardKpiCard } from "@/components/dashboard/dashboard-kpi-card"
import type { DashboardCounts } from "@workspace/schemas/analytics"
import { CalendarDays, CheckCircle2, ClipboardList, Clock3, FileEdit } from "lucide-react"

export function DashboardKpiGrid({ counts }: { counts: DashboardCounts }) {
  return (
    <section aria-labelledby="kpi-heading">
      <h2 id="kpi-heading" className="sr-only">
        KPI metrics
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5" aria-label="Survey pipeline KPIs">
        <DashboardKpiCard label="Total Surveys" value={counts.total} icon={ClipboardList} tone="neutral" />
        <DashboardKpiCard label="Draft" value={counts.drafts} icon={FileEdit} tone="muted" hint="Not yet submitted" />
        <DashboardKpiCard
          label="Pending QC"
          value={counts.pending}
          icon={Clock3}
          tone="amber"
          hint="Submitted minus Approved QC"
        />
        <DashboardKpiCard
          label="Created Today"
          value={counts.today}
          hint={`${(counts.submittedToday ?? 0).toLocaleString()} submitted today`}
          icon={CalendarDays}
          tone="blue"
        />
        <DashboardKpiCard
          label="Approved QC"
          value={counts.approved}
          icon={CheckCircle2}
          tone="emerald"
          hint="QC passed"
        />
      </div>
    </section>
  )
}
