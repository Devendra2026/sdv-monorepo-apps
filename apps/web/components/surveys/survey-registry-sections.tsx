"use client";

import { SectionHeader } from "@/components/design-system/executive-hero";
import { GlassCard } from "@/components/design-system/glass-card";
import { FadeIn } from "@/components/design-system/motion";
import type { SurveyDataTableRow } from "@/components/surveys/survey-data-table";
import { SurveyRegistryTable } from "@/components/surveys/survey-registry-table";
import { SurveyorSearch } from "@/components/surveys/surveyor-search";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SurveyQueueStats } from "@/hooks/surveys/useSurveyQueue";
import { SURVEY_MODULE } from "@/lib/design-system";

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

export function SurveyReviewRegistry({
  stats,
  activeTab,
  filteredCount,
  isLoading,
  rows,
  pageStart,
  surveyorSearch,
  onSurveyorSearchChange,
  onTabChange,
  showSurveyor = true,
}: {
  stats: SurveyQueueStats;
  activeTab: string;
  filteredCount: number;
  isLoading: boolean;
  rows: SurveyDataTableRow[] | undefined;
  pageStart: number;
  surveyorSearch: string;
  onSurveyorSearchChange: (term: string) => void;
  onTabChange: (tab: string) => void;
  showSurveyor?: boolean;
}) {
  return (
    <FadeIn delay={0.08}>
      <GlassCard padding="none" className={`overflow-hidden ${SURVEY_MODULE.cardBorder}`}>
        <div className="border-b border-indigo-500/20 bg-linear-to-r from-indigo-500/10 via-card to-transparent px-5 py-4 dark:from-indigo-500/15">
          <SectionHeader
            title="Survey Data Table"
            description={`${filteredCount.toLocaleString()} records${activeTab !== "all" ? " in selected tab" : ""}`}
          />
        </div>
        <div className="border-b border-border/60 bg-muted/15 px-4 py-3">
          <SurveyorSearch value={surveyorSearch} onChange={onSurveyorSearchChange} />
        </div>
        <div className="border-b border-border/60 bg-muted/15 px-4 py-2.5">
          <Tabs value={activeTab} onValueChange={onTabChange}>
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1.5 bg-transparent p-0">
              <TabPill value="all" label="All" count={stats.total} activeColor={`${SURVEY_MODULE.tabActive}`} />
              <TabPill
                value="draft"
                label="Draft"
                count={stats.drafts}
                activeColor="data-[state=active]:bg-violet-600 data-[state=active]:text-white"
              />
              <TabPill
                value="submitted"
                label="Submitted"
                count={stats.submitted}
                activeColor="data-[state=active]:bg-indigo-600 data-[state=active]:text-white"
              />
              <TabPill
                value="qcPending"
                label="QC Pending"
                count={stats.qcPending}
                activeColor="data-[state=active]:bg-warning data-[state=active]:text-amber-950"
              />
              <TabPill
                value="qcApproved"
                label="QC Approved"
                count={stats.qcApproved}
                activeColor="data-[state=active]:bg-success data-[state=active]:text-white"
              />
              <TabPill
                value="qcRejected"
                label="Rejected"
                count={stats.qcRejected}
                activeColor="data-[state=active]:bg-brand-red data-[state=active]:text-white"
              />
            </TabsList>
          </Tabs>
        </div>
        <div className="overflow-x-auto p-4">
          <SurveyRegistryTable rows={isLoading ? undefined : rows} pageStart={pageStart} showSurveyor={showSurveyor} />
        </div>
      </GlassCard>
    </FadeIn>
  );
}
