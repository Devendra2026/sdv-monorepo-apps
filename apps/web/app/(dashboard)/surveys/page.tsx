"use client";

import { PageTransition } from "@/components/design-system/motion";
import { RoleGate } from "@/components/shared/role-gate";
import {
  SurveyCommandHero,
  SurveyFiltersSection,
  SurveyMetricsSection,
  SurveyWardSection,
} from "@/components/surveys/survey-queue-sections";
import { useSurveyQueue } from "@/hooks/surveys/useSurveyQueue";

function SurveyCommandCenterContent() {
  const { isLoading, stats, wardStats, scope, dateFilters, handleScopeChange, handleDateFiltersChange } =
    useSurveyQueue({
      mode: "command",
    });

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
  );
}

export default function SurveyCommandCenterPage() {
  return (
    <RoleGate
      mode="page"
      anyOf={["surveys.viewAssigned", "surveys.viewAll"]}
      deniedDescription="The Survey Command Center is available to supervisors and administrators."
      redirectTo="/surveys/registry"
    >
      <SurveyCommandCenterContent />
    </RoleGate>
  );
}
