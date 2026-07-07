"use client";

import { ExecutiveHero, SectionHeader } from "@/components/design-system/executive-hero";
import { GlassCard } from "@/components/design-system/glass-card";
import { MetricCard } from "@/components/design-system/metric-card";
import { FadeIn, StaggerGrid, StaggerItem } from "@/components/design-system/motion";
import { QcPipeline } from "@/components/design-system/qc-pipeline";
import { QcRegistrySearchBar, QcRegistryTable, type QcRegistryRow } from "@/components/qc/qc-registry-table";
import { QcWardCards } from "@/components/qc/qc-ward-cards";
import { CardsSkeleton } from "@/components/shared/loading";
import { SurveyFilters, type FilterState } from "@/components/surveys/survey-filters";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMasters } from "@/hooks/masters/useMasters";
import type { QcQueueStats } from "@/hooks/qc/useQcQueue";
import type { ParcelSiblingIndex } from "@/lib/qc/parcel-siblings";
import type { QcWardRow } from "@/lib/qc/ward-stats";
import { isQcScopeComplete, type QcWorkScope } from "@/lib/qc/work-scope";
import { estimateQcPendingCount } from "@/lib/surveys/survey-list-filters";
import { CheckCircle2, Clock3, FileEdit, Filter, MapPin, Percent, ShieldCheck, Table2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function TabPill({
  value,
  label,
  count,
  activeColor,
}: {
  value: string;
  label: string;
  count: number;
  activeColor: string;
}) {
  return (
    <TabsTrigger
      value={value}
      className={`flex cursor-pointer items-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-all duration-200 hover:border-border hover:text-foreground ${activeColor}`}
    >
      {label}
      <span className="min-w-5 rounded-full bg-black/10 px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums dark:bg-white/10">
        {count}
      </span>
    </TabsTrigger>
  );
}

export function QcCommandHero() {
  return (
    <FadeIn>
      <ExecutiveHero
        eyebrow="Quality Control"
        title="QC Command Center"
        description="Set your district, ULB, and ward once in Smart Filters — then review surveys ward-by-ward until complete."
        icon={ShieldCheck}
        gradient="amber"
      />
    </FadeIn>
  );
}

export function QcRegistryHero() {
  return (
    <FadeIn>
      <ExecutiveHero
        eyebrow="Quality Control"
        title="QC Review Registry"
        description="Search and open submitted surveys for verification, correction, and approval within your active ward."
        icon={Table2}
        gradient="amber"
      />
    </FadeIn>
  );
}

export function QcMetricsSection({ stats, isLoading }: { stats: QcQueueStats; isLoading: boolean }) {
  const remaining = estimateQcPendingCount({
    submitted: stats.submitted,
    approved: stats.approved,
    rejected: stats.rejected,
  });

  return (
    <section aria-labelledby="qc-kpi-heading">
      <SectionHeader
        id="qc-kpi-heading"
        title="QC Metrics"
        description="Live counts for your current geographic filter scope"
        className="mb-4"
      />
      {isLoading ? (
        <CardsSkeleton count={4} />
      ) : (
        <StaggerGrid className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
          <StaggerItem>
            <MetricCard
              label="Pending QC"
              value={stats.pending.toLocaleString()}
              hint={`${remaining.toLocaleString()} remaining · ${stats.submitted.toLocaleString()} submitted total`}
              icon={Clock3}
              tone="warning"
            />
          </StaggerItem>
          <StaggerItem>
            <MetricCard
              label="Approved QC"
              value={stats.approved.toLocaleString()}
              hint={`${stats.qcCompletionPct}% QC complete`}
              icon={CheckCircle2}
              tone="success"
            />
          </StaggerItem>
          <StaggerItem>
            <MetricCard
              label="QC Progress"
              value={`${stats.qcCompletionPct}%`}
              hint={`${stats.approved.toLocaleString()} approved of ${(stats.pending + stats.approved + stats.rejected).toLocaleString()} in queue`}
              icon={Percent}
              tone="info"
            />
          </StaggerItem>
          <StaggerItem>
            <MetricCard
              label="Field Drafts"
              value={stats.drafts.toLocaleString()}
              hint={`${stats.submittedToday.toLocaleString()} submitted today`}
              icon={FileEdit}
              tone="default"
            />
          </StaggerItem>
        </StaggerGrid>
      )}
    </section>
  );
}

export function QcPipelineSection({
  stats,
  rejectedCount,
  isLoading,
}: {
  stats: QcQueueStats;
  rejectedCount: number;
  isLoading: boolean;
}) {
  const router = useRouter();

  if (isLoading) {
    return (
      <FadeIn delay={0.03}>
        <CardsSkeleton count={1} />
      </FadeIn>
    );
  }

  return (
    <FadeIn delay={0.03}>
      <QcPipeline
        pending={stats.pending}
        approved={stats.approved}
        rejected={rejectedCount}
        onStageClick={(tab) => router.push(`/qc/registry?tab=${tab}`)}
      />
    </FadeIn>
  );
}

export function QcWardSection({ wardStats, isLoading }: { wardStats: QcWardRow[]; isLoading: boolean }) {
  return (
    <FadeIn delay={0.06}>
      <section aria-labelledby="qc-ward-heading">
        <SectionHeader
          id="qc-ward-heading"
          title="Ward Wise QC Data"
          description="Field drafts, QC pending, approved, and total properties per ward"
          className="mb-4"
        />
        <QcWardCards rows={isLoading ? undefined : wardStats} isLoading={isLoading} />
      </section>
    </FadeIn>
  );
}

export function QcScopeBanner({ scope }: { scope: QcWorkScope }) {
  const { masters } = useMasters();
  const district = masters?.districts.find((d) => d._id === scope.districtId);
  const ulb = masters?.ulbs.find((m) => m._id === scope.municipalityId);
  const scopeLabel = [district?.name, ulb?.name, scope.wardNo ? `Ward ${scope.wardNo}` : undefined]
    .filter(Boolean)
    .join(" · ");

  return (
    <FadeIn delay={0.02}>
      <GlassCard padding="md" className="border-amber-500/20 bg-amber-50/30 dark:bg-amber-950/15">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                Active QC scope
              </p>
              <p className="truncate text-sm font-medium text-foreground">
                {scopeLabel || "No ward selected — set Smart Filters on the command center"}
              </p>
              {!isQcScopeComplete(scope) && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Select district, ULB, and ward in Smart Filters to begin ward-wise QC.
                </p>
              )}
            </div>
          </div>
          <Link
            href="/qc"
            className="shrink-0 text-xs font-semibold text-amber-800 underline-offset-2 hover:underline dark:text-amber-200"
          >
            Change ward
          </Link>
        </div>
      </GlassCard>
    </FadeIn>
  );
}

export function QcFiltersSection({
  scope,
  dateFilters,
  onScopeChange,
  onDateFiltersChange,
}: {
  scope: QcWorkScope;
  dateFilters: Pick<FilterState, "month" | "fromDate" | "toDate">;
  onScopeChange: (next: QcWorkScope) => void;
  onDateFiltersChange: (next: Pick<FilterState, "month" | "fromDate" | "toDate">) => void;
}) {
  const filterValue: FilterState = {
    search: "",
    districtId: scope.districtId,
    municipalityId: scope.municipalityId,
    wardNo: scope.wardNo,
    month: dateFilters.month,
    fromDate: dateFilters.fromDate,
    toDate: dateFilters.toDate,
  };

  return (
    <FadeIn delay={0.04}>
      <GlassCard padding="md" className="border-amber-500/15">
        <SectionHeader
          title="Smart Filters"
          description="Select district, ULB, and ward to focus your QC work. Change ward here when the current ward is complete."
          action={<Filter className="h-4 w-4 text-amber-700 dark:text-amber-300" aria-hidden />}
          className="mb-4"
        />
        <SurveyFilters
          variant="scope-and-dates"
          value={filterValue}
          onChange={(next) => {
            onScopeChange({
              districtId: next.districtId,
              municipalityId: next.municipalityId,
              wardNo: next.wardNo,
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

export function QcReviewRegistry({
  stats,
  rejectedCount,
  parcelSharedCount = 0,
  activeTab,
  filteredCount,
  isLoading,
  rows,
  pageStart,
  registrySearch,
  onRegistrySearchChange,
  onTabChange,
  parcelSiblingIndex,
}: {
  stats: QcQueueStats;
  rejectedCount: number;
  parcelSharedCount?: number;
  activeTab: string;
  filteredCount: number;
  isLoading: boolean;
  rows: QcRegistryRow[] | undefined;
  pageStart: number;
  registrySearch: string;
  onRegistrySearchChange: (term: string) => void;
  onTabChange: (tab: string) => void;
  parcelSiblingIndex?: ParcelSiblingIndex;
}) {
  const totalDecided = stats.pending + stats.approved + rejectedCount;
  const activeCount = stats.pending + stats.approved;

  return (
    <FadeIn delay={0.08}>
      <GlassCard padding="none" className="overflow-hidden border-amber-500/15">
        <div className="border-b border-amber-500/20 bg-linear-to-r from-amber-500/10 via-card to-transparent px-5 py-4 dark:from-amber-500/15">
          <SectionHeader
            title="QC Review Registry"
            description={`${filteredCount.toLocaleString()} records${activeTab !== "all" ? " in selected tab" : ""} · click Review to verify`}
          />
        </div>
        <div className="border-b border-border/60 bg-muted/15 px-4 py-3">
          <QcRegistrySearchBar value={registrySearch} onChange={onRegistrySearchChange} />
        </div>
        <div className="border-b border-border/60 bg-muted/15 px-4 py-2.5">
          <Tabs value={activeTab} onValueChange={onTabChange}>
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1.5 bg-transparent p-0">
              <TabPill
                value="active"
                label="Pending & Approved"
                count={activeCount}
                activeColor="data-[state=active]:bg-amber-600 data-[state=active]:text-white"
              />
              <TabPill
                value="pending"
                label="Pending QC"
                count={stats.pending}
                activeColor="data-[state=active]:bg-warning data-[state=active]:text-amber-950"
              />
              <TabPill
                value="approved"
                label="Approved"
                count={stats.approved}
                activeColor="data-[state=active]:bg-success data-[state=active]:text-white"
              />
              <TabPill
                value="rejected"
                label="Returned"
                count={rejectedCount}
                activeColor="data-[state=active]:bg-brand-red data-[state=active]:text-white"
              />
              <TabPill
                value="parcelShared"
                label="Parcel shared"
                count={parcelSharedCount}
                activeColor="data-[state=active]:bg-amber-700 data-[state=active]:text-white"
              />
              <TabPill
                value="all"
                label="All"
                count={totalDecided}
                activeColor="data-[state=active]:bg-brand-navy data-[state=active]:text-white dark:data-[state=active]:bg-primary"
              />
            </TabsList>
          </Tabs>
        </div>
        <div className="overflow-x-auto p-4">
          <QcRegistryTable
            rows={isLoading ? undefined : rows}
            pageStart={pageStart}
            hrefBase="/qc"
            siblingIndex={parcelSiblingIndex}
          />
        </div>
      </GlassCard>
    </FadeIn>
  );
}
