"use client";

import { AuditTable } from "@/components/audit/audit-table";
import { ExecutiveHero, SectionHeader } from "@/components/design-system/executive-hero";
import { GlassCard, GlassCardHeader } from "@/components/design-system/glass-card";
import { MetricCard } from "@/components/design-system/metric-card";
import { FadeIn, StaggerGrid, StaggerItem } from "@/components/design-system/motion";
import { TablePagination } from "@/components/shared/table-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AuditEntry } from "@/schema/audit/index";
import { Activity, Clock, Filter, Layers, ScrollText, Search, X, Zap } from "lucide-react";

const ALL = "__all__";

export function AuditHero() {
  return (
    <FadeIn>
      <ExecutiveHero
        eyebrow="Compliance"
        title="Audit Log"
        description="Append-only trail of every mutation across the system — who did what, when, and on which record."
        icon={ScrollText}
        gradient="brand"
      />
    </FadeIn>
  );
}

export function AuditMetricsSection({
  totalLabel,
  actionTypes,
  entityTypes,
  todayCount,
}: {
  totalLabel: string;
  actionTypes: number | string;
  entityTypes: number | string;
  todayCount: number | string;
}) {
  return (
    <section aria-labelledby="audit-kpi-heading">
      <SectionHeader
        id="audit-kpi-heading"
        title="Activity Metrics"
        description="Recent volume and diversity of system events"
        className="mb-4"
      />
      <StaggerGrid className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <StaggerItem>
          <MetricCard label="Recent Entries" value={totalLabel} hint="indexed events" icon={ScrollText} tone="info" />
        </StaggerItem>
        <StaggerItem>
          <MetricCard label="Action Types" value={actionTypes} hint="distinct verbs" icon={Zap} tone="ai" />
        </StaggerItem>
        <StaggerItem>
          <MetricCard label="Entity Types" value={entityTypes} hint="tables & resources" icon={Layers} tone="muted" />
        </StaggerItem>
        <StaggerItem>
          <MetricCard label="Last 24 Hours" value={todayCount} hint="recent mutations" icon={Clock} tone="success" />
        </StaggerItem>
      </StaggerGrid>
    </section>
  );
}

export function AuditFiltersSection({
  search,
  onSearchChange,
  action,
  onActionChange,
  entity,
  onEntityChange,
  actionOptions,
  entityOptions,
  hasFilters,
  onClear,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  action: string | undefined;
  onActionChange: (value: string | undefined) => void;
  entity: string | undefined;
  onEntityChange: (value: string | undefined) => void;
  actionOptions: string[] | undefined;
  entityOptions: string[] | undefined;
  hasFilters: boolean;
  onClear: () => void;
}) {
  return (
    <FadeIn delay={0.06}>
      <GlassCard padding="md">
        <GlassCardHeader
          title="Filters"
          description="Narrow by action, entity type, or free-text search"
          icon={<Filter className="h-4 w-4" aria-hidden />}
          action={
            hasFilters ? (
              <Badge variant="secondary" className="text-[10px] font-medium">
                Active
              </Badge>
            ) : undefined
          }
        />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              placeholder="Search action, actor, entity, or ID…"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 font-sans"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={action ?? ALL} onValueChange={(v) => onActionChange(v === ALL ? undefined : v)}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All actions</SelectItem>
                {actionOptions?.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={entity ?? ALL} onValueChange={(v) => onEntityChange(v === ALL ? undefined : v)}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Entity type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All entities</SelectItem>
                {entityOptions?.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={onClear} className="shrink-0 text-muted-foreground">
                <X className="h-3.5 w-3.5" aria-hidden />
                Clear
              </Button>
            )}
          </div>
        </div>
      </GlassCard>
    </FadeIn>
  );
}

export function AuditFeedSection({
  rows,
  isLoading,
  pageNumber,
  pageSize,
  filteredCount,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  onPageSizeChange,
}: {
  rows: AuditEntry[] | undefined;
  isLoading: boolean;
  pageNumber: number;
  pageSize: number;
  filteredCount: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onPageSizeChange: (size: number) => void;
}) {
  return (
    <FadeIn delay={0.1}>
      <GlassCard padding="none" className="overflow-hidden">
        <div className="border-b border-border/60 px-5 py-4">
          <SectionHeader
            title="Activity Feed"
            description={`Page ${pageNumber}${rows !== undefined ? ` · ${filteredCount} on this page` : ""}`}
            action={<Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />}
          />
        </div>
        <AuditTable rows={rows} skeletonRows={pageSize} />
        {!isLoading && rows !== undefined && (
          <div className="border-t border-border/60 px-5 pb-4">
            <TablePagination
              pageNumber={pageNumber}
              pageSize={pageSize}
              itemCount={filteredCount}
              canGoPrev={canGoPrev}
              canGoNext={canGoNext}
              onPrev={onPrev}
              onNext={onNext}
              pageSizeOptions={[10, 15, 25, 50]}
              onPageSizeChange={onPageSizeChange}
            />
          </div>
        )}
      </GlassCard>
    </FadeIn>
  );
}
