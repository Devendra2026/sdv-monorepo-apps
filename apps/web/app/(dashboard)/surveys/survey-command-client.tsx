"use client"

import { PageTransition } from "@/components/design-system/motion"
import { RoleGate } from "@/components/shared/role-gate"
import {
  SurveyCommandHero,
  SurveyFiltersSection,
  SurveyMetricsSection,
  SurveyWardSection,
} from "@/components/surveys/survey-queue-sections"
import { useSurveyQueue } from "@/hooks/surveys/useSurveyQueue"
import { api } from "@workspace/backend/convex/_generated/api.js"
import { usePreloadedQuery, type Preloaded } from "convex/react"
import type { FunctionReturnType } from "convex/server"

type CommandCenterStats = FunctionReturnType<typeof api.surveys.queries.commandCenterStats>

function SurveyCommandCenterContent({ nowMs: _nowMs, seedStats }: { nowMs: number; seedStats?: CommandCenterStats }) {
  const { isLoading, stats, wardStats, scope, dateFilters, handleScopeChange, handleDateFiltersChange } =
    useSurveyQueue({
      mode: "command",
      seedStats,
    })

  return (
    <PageTransition className="space-y-6 lg:space-y-8">
      <SurveyCommandHero />
      <SurveyFiltersSection
        scope={scope}
        dateFilters={dateFilters}
        onScopeChange={handleScopeChange}
        onDateFiltersChange={handleDateFiltersChange}
      />
      <SurveyMetricsSection stats={stats} isLoading={isLoading} />
      <SurveyWardSection wardStats={wardStats} isLoading={isLoading} />
    </PageTransition>
  )
}

export function SurveyCommandClient({
  nowMs,
  preloadedStats,
}: {
  nowMs: number
  preloadedStats: Preloaded<typeof api.surveys.queries.commandCenterStats>
}) {
  const seedStats = usePreloadedQuery(preloadedStats)

  return (
    <RoleGate
      mode="page"
      anyOf={["surveys.viewAssigned", "surveys.viewAll"]}
      deniedDescription="The Survey Command Center is available to supervisors and administrators."
      redirectTo="/surveys/registry"
    >
      <SurveyCommandCenterContent nowMs={nowMs} seedStats={seedStats} />
    </RoleGate>
  )
}
