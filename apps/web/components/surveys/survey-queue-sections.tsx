"use client";

import { ExecutiveHero, SectionHeader } from "@/components/design-system/executive-hero";
import { GlassCard } from "@/components/design-system/glass-card";
import { MetricCard } from "@/components/design-system/metric-card";
import { FadeIn, StaggerGrid, StaggerItem } from "@/components/design-system/motion";
import { CardsSkeleton } from "@/components/shared/loading";
import { SurveyFilters, type FilterState } from "@/components/surveys/survey-filters";
import { SurveyWardCards } from "@/components/surveys/survey-ward-cards";
import { useMasters } from "@/hooks/masters/useMasters";
import type { SurveyQueueStats } from "@/hooks/surveys/useSurveyQueue";
import { SURVEY_MODULE } from "@/lib/design-system";
import { isSurveyScopeComplete, type SurveyWorkScope } from "@/lib/survey/work-scope";
import type { SurveyWardRow } from "@/lib/surveys/ward-stats";
import { CheckCircle2, ClipboardList, FileEdit, Filter, Home, MapPin, Send } from "lucide-react";
import Link from "next/link";

export function SurveyCommandHero() {
  return (
    <FadeIn>
      <ExecutiveHero
        eyebrow="Field Surveys"
        title="Survey Command Center"
        description="Filter by district, ULB, ward, and status — then monitor ward-wise field progress and surveyor activity."
        icon={ClipboardList}
        gradient="brand"
      />
    </FadeIn>
  );
}

export function SurveyRegistryHero() {
  return (
    <FadeIn>
      <ExecutiveHero
        eyebrow="Field Surveys"
        title="Survey Registry"
        description="Search surveyors, filter records, and open field surveys across your assigned scope."
        icon={ClipboardList}
        gradient="brand"
      />
    </FadeIn>
  );
}

export function SurveyMetricsSection({ stats, isLoading }: { stats: SurveyQueueStats; isLoading: boolean }) {
  return (
    <section aria-labelledby="survey-metrics-heading">
      <SectionHeader id="survey-metrics-heading" title="Survey KPIs" className="mb-4" />
      {isLoading ? (
        <CardsSkeleton count={4} />
      ) : (
        <StaggerGrid className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StaggerItem>
            <MetricCard
              label="Total Properties"
              value={stats.total.toLocaleString()}
              hint={`${stats.surveyCompletionPct}% avg field completion`}
              icon={Home}
              tone="info"
            />
          </StaggerItem>
          <StaggerItem>
            <MetricCard
              label="Draft Surveys"
              value={stats.drafts.toLocaleString()}
              hint={`${stats.submittedToday.toLocaleString()} submitted today`}
              icon={FileEdit}
              tone="default"
            />
          </StaggerItem>
          <StaggerItem>
            <MetricCard
              label="Submitted Surveys"
              value={stats.submitted.toLocaleString()}
              hint={`${stats.qcPending.toLocaleString()} awaiting QC`}
              icon={Send}
              tone="info"
            />
          </StaggerItem>
          <StaggerItem>
            <MetricCard
              label="QC Approved"
              value={stats.qcApproved.toLocaleString()}
              hint={`${stats.qcRejected.toLocaleString()} returned`}
              icon={CheckCircle2}
              tone="success"
            />
          </StaggerItem>
        </StaggerGrid>
      )}
    </section>
  );
}

export function SurveyWardSection({ wardStats, isLoading }: { wardStats: SurveyWardRow[]; isLoading: boolean }) {
  return (
    <FadeIn delay={0.06}>
      <section aria-labelledby="survey-ward-heading">
        <SectionHeader
          id="survey-ward-heading"
          title="Ward-wise Survey Data"
          description="Total properties, drafts, submitted surveys, QC approved, and active surveyors per ward"
          className="mb-4"
        />
        <SurveyWardCards rows={isLoading ? undefined : wardStats} isLoading={isLoading} />
      </section>
    </FadeIn>
  );
}

export function SurveyScopeBanner({ scope }: { scope: SurveyWorkScope }) {
  const { masters } = useMasters();
  const district = masters?.districts.find((d) => d._id === scope.districtId);
  const ulb = masters?.ulbs.find((m) => m._id === scope.municipalityId);
  const scopeLabel = [district?.name, ulb?.name, scope.wardNo ? `Ward ${scope.wardNo}` : undefined]
    .filter(Boolean)
    .join(" · ");

  return (
    <FadeIn delay={0.02}>
      <GlassCard padding="md" className={SURVEY_MODULE.scopeBanner}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700 dark:text-indigo-300" aria-hidden />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-800 dark:text-indigo-200">
                Active survey scope
              </p>
              <p className="truncate text-sm font-medium text-foreground">
                {scopeLabel || "No scope selected — set Smart Filters on the command center"}
              </p>
              {!isSurveyScopeComplete(scope) && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Select district and ULB in Smart Filters to begin ward-wise monitoring.
                </p>
              )}
            </div>
          </div>
          <Link
            href="/surveys"
            className="shrink-0 text-xs font-semibold text-indigo-800 underline-offset-2 hover:underline dark:text-indigo-200"
          >
            Change scope
          </Link>
        </div>
      </GlassCard>
    </FadeIn>
  );
}

export function SurveyFiltersSection({
  scope,
  dateFilters,
  onScopeChange,
  onDateFiltersChange,
}: {
  scope: SurveyWorkScope;
  dateFilters: Pick<FilterState, "month" | "fromDate" | "toDate">;
  onScopeChange: (next: SurveyWorkScope) => void;
  onDateFiltersChange: (next: Pick<FilterState, "month" | "fromDate" | "toDate">) => void;
}) {
  const filterValue: FilterState = {
    districtId: scope.districtId,
    municipalityId: scope.municipalityId,
    wardNo: scope.wardNo,
    status: scope.status,
    qcStatus: scope.qcStatus,
    month: dateFilters.month,
    fromDate: dateFilters.fromDate,
    toDate: dateFilters.toDate,
  };

  return (
    <FadeIn delay={0.04}>
      <GlassCard padding="md" className={SURVEY_MODULE.cardBorder}>
        <SectionHeader
          title="Smart Filters"
          description="District, ULB, ward, survey status, QC status, and date range for focused analysis."
          action={<Filter className="h-4 w-4 text-indigo-700 dark:text-indigo-300" aria-hidden />}
          className="mb-4"
        />
        <SurveyFilters
          variant="command-center"
          value={filterValue}
          onChange={(next) => {
            onScopeChange({
              districtId: next.districtId,
              municipalityId: next.municipalityId,
              wardNo: next.wardNo,
              status: next.status,
              qcStatus: next.qcStatus,
            });
            onDateFiltersChange({
              month: next.month,
              fromDate: next.fromDate,
              toDate: next.toDate,
            });
          }}
        />
      </GlassCard>
    </FadeIn>
  );
}
