"use client"

import { SurveyRegistryContent } from "@/app/(dashboard)/surveys/registry/survey-registry-content"
import { RoleGate } from "@/components/shared/role-gate"
import { SurveyPageSkeleton } from "@/components/shared/survey-route-skeleton"
import { Suspense } from "react"

export function SurveyRegistryFallback({ nowMs: _nowMs }: { nowMs: number }) {
  return (
    <RoleGate
      mode="page"
      anyOf={["surveys.viewOwn", "surveys.viewAssigned", "surveys.viewAll"]}
      deniedDescription="The Surveys module is for field surveyors and supervisors. QC staff should use the QC Portal."
      redirectTo="/qc"
    >
      <Suspense fallback={<SurveyPageSkeleton variant="registry" />}>
        <SurveyRegistryContent />
      </Suspense>
    </RoleGate>
  )
}
