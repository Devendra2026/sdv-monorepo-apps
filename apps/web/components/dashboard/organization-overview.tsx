"use client"

import { DashboardKpiCard } from "@/components/dashboard/dashboard-kpi-card"
import { SectionHeader } from "@/components/design-system/executive-hero"
import type { StatsBreakdown } from "@workspace/schemas/analytics"
import { Building2, MapPin, ShieldCheck, Users } from "lucide-react"

export function OrganizationOverview({ breakdown }: { breakdown: StatsBreakdown }) {
  return (
    <section aria-labelledby="org-heading" className="space-y-4">
      <SectionHeader
        id="org-heading"
        title="Organization Overview"
        description="Workforce capacity and geographic scope"
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DashboardKpiCard
          label="Active Surveyors"
          value={breakdown.filterOptions?.surveyors?.length ?? 0}
          icon={Users}
          tone="neutral"
          hint="Field workforce"
        />
        <DashboardKpiCard
          label="Active QC Supervisors"
          value={breakdown.filterOptions?.qcSupervisors?.length ?? 0}
          icon={ShieldCheck}
          tone="neutral"
          hint="Review workforce"
        />
        <DashboardKpiCard
          label="Districts"
          value={breakdown.filterOptions?.districts?.length ?? 0}
          icon={MapPin}
          tone="neutral"
          hint="Geographic scope"
        />
        <DashboardKpiCard
          label="Municipalities"
          value={breakdown.filterOptions?.municipalities?.length ?? 0}
          icon={Building2}
          tone="neutral"
          hint="ULBs in scope"
        />
      </div>
    </section>
  )
}
