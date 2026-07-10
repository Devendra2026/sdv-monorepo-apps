"use client"

import { PageTransition } from "@/components/design-system/motion"
import {
  QcCommandHero,
  QcFiltersSection,
  QcMetricsSection,
  QcPipelineSection,
  QcWardSection,
} from "@/components/qc/qc-queue-sections"
import { RoleGate } from "@/components/shared/role-gate"
import { useQcCommandCenter } from "@/hooks/qc/useQcCommandCenter"
import { qcPerfMark } from "@/lib/qc/qc-perf"
import { api } from "@workspace/backend/convex/_generated/api.js"
import { usePreloadedQuery, type Preloaded } from "convex/react"
import type { FunctionReturnType } from "convex/server"
import { useEffect } from "react"

type CommandCenterStats = FunctionReturnType<typeof api.qc.queries.commandCenterStats>

function QcCommandCenterContent({ seedStats }: { nowMs: number; seedStats?: CommandCenterStats }) {
  const { isLoading, stats, wardStats, rejectedCount, scope, dateFilters, handleScopeChange, handleDateFiltersChange } =
    useQcCommandCenter({ seedStats })

  useEffect(() => {
    qcPerfMark("qc.command_center.mount")
  }, [])

  return (
    <PageTransition className="space-y-6 lg:space-y-8">
      <QcCommandHero />
      <QcFiltersSection
        scope={scope}
        dateFilters={dateFilters}
        onScopeChange={handleScopeChange}
        onDateFiltersChange={handleDateFiltersChange}
      />
      <QcPipelineSection stats={stats} rejectedCount={rejectedCount} isLoading={isLoading} />
      <QcMetricsSection stats={stats} isLoading={isLoading} />
      <QcWardSection wardStats={wardStats} isLoading={isLoading} />
    </PageTransition>
  )
}

export function QcCommandClient({
  nowMs,
  preloadedStats,
}: {
  nowMs: number
  preloadedStats: Preloaded<typeof api.qc.queries.commandCenterStats>
}) {
  const seedStats = usePreloadedQuery(preloadedStats)

  return (
    <RoleGate
      mode="page"
      capability="qc.review"
      deniedDescription="Quality Control is available to QC supervisors and administrators."
    >
      <QcCommandCenterContent nowMs={nowMs} seedStats={seedStats} />
    </RoleGate>
  )
}
