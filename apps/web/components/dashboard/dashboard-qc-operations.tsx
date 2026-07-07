"use client"

import { DashboardKpiCard } from "@/components/dashboard/dashboard-kpi-card"
import { SectionHeader } from "@/components/design-system/executive-hero"
import { can } from "@/lib/permissions"
import { useCurrentUser } from "@/lib/sessions"
import type { DashboardCounts } from "@workspace/schemas/analytics"
import { Button } from "@workspace/ui/components/button"
import { AlertCircle, CheckCircle2, Clock3, XCircle } from "lucide-react"
import Link from "next/link"

function formatRejectionRate(approved: number, rejected: number): string {
  const total = approved + rejected
  if (total === 0) return "—"
  return `${Math.round((rejected / total) * 100)}%`
}

function deriveQueueHealth(
  pending: number,
  approved: number
): {
  label: string
  icon: typeof CheckCircle2
  tone: "emerald" | "amber" | "neutral"
} {
  if (pending === 0) {
    return { label: "Clear", icon: CheckCircle2, tone: "emerald" }
  }
  if (pending > approved && pending > 10) {
    return { label: "Backlogged", icon: AlertCircle, tone: "amber" }
  }
  if (pending > 0) {
    return { label: "Active", icon: Clock3, tone: "amber" }
  }
  return { label: "Healthy", icon: CheckCircle2, tone: "emerald" }
}

export function DashboardQcOperations({ counts }: { counts: DashboardCounts }) {
  const { role } = useCurrentUser()

  const health = deriveQueueHealth(counts.pending, counts.approved)
  const HealthIcon = health.icon
  const rejectionRate = formatRejectionRate(counts.approved, counts.rejected)
  const showQcCta = can(role, "qc.review") && counts.pending > 0

  return (
    <section aria-labelledby="qc-ops-heading" className="space-y-4">
      <SectionHeader
        id="qc-ops-heading"
        title="QC Operations"
        description="Review workload and approval throughput"
        action={
          showQcCta ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/qc">Open QC Queue</Link>
            </Button>
          ) : undefined
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DashboardKpiCard
          label="Pending Workload"
          value={counts.pending}
          icon={Clock3}
          tone="amber"
          hint="Awaiting QC review"
        />
        <DashboardKpiCard
          label="Approvals"
          value={counts.approved}
          icon={CheckCircle2}
          tone="emerald"
          hint="Total approved"
        />
        <DashboardKpiCard
          label="Rejections"
          value={counts.rejected}
          icon={XCircle}
          tone={counts.rejected > 0 ? "destructive" : "muted"}
          hint={`Rejection rate: ${rejectionRate}`}
        />
        <DashboardKpiCard
          label="Queue Health"
          value={health.label}
          icon={HealthIcon}
          tone={health.tone}
          hint={`${counts.pending.toLocaleString()} pending · ${counts.approved.toLocaleString()} approved`}
        />
      </div>
    </section>
  )
}
