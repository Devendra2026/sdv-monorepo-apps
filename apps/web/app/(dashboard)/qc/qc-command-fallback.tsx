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
import { useEffect } from "react"

function QcCommandCenterFallbackContent() {
  const { isLoading, stats, wardStats, rejectedCount, scope, dateFilters, handleScopeChange, handleDateFiltersChange } =
    useQcCommandCenter()

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

export function QcCommandFallback() {
  return (
    <RoleGate
      mode="page"
      capability="qc.review"
      deniedDescription="Quality Control is available to QC supervisors and administrators."
    >
      <QcCommandCenterFallbackContent />
    </RoleGate>
  )
}
