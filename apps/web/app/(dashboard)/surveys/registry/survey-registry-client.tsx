"use client"

import { SurveyRegistryContent } from "@/app/(dashboard)/surveys/registry/survey-registry-content"
import { RoleGate } from "@/components/shared/role-gate"
import { SurveyPageSkeleton } from "@/components/shared/survey-route-skeleton"
import { api } from "@workspace/backend/convex/_generated/api.js"
import { usePreloadedQuery, type Preloaded } from "convex/react"
import { Suspense } from "react"

export function SurveyRegistryClient({
  nowMs,
  preloadedRegistry,
}: {
  nowMs: number
  preloadedRegistry: Preloaded<typeof api.surveys.queries.listPaginated>
}) {
  const seedRegistryPage = usePreloadedQuery(preloadedRegistry)

  return (
    <RoleGate
      mode="page"
      anyOf={["surveys.viewOwn", "surveys.viewAssigned", "surveys.viewAll"]}
      deniedDescription="The Surveys module is for field surveyors and supervisors. QC staff should use the QC Portal."
      redirectTo="/qc"
    >
      <Suspense fallback={<SurveyPageSkeleton variant="registry" />}>
        <SurveyRegistryContent seedRegistryPage={seedRegistryPage} nowMs={nowMs} />
      </Suspense>
    </RoleGate>
  )
}
