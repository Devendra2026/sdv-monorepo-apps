"use client";

import { EmptyState } from "@/components/shared/empty-state";
import { CardsSkeleton } from "@/components/shared/loading";
import { Button } from "@/components/ui/button";
import type { SurveyWardRow } from "@/lib/surveys/ward-stats";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2, FileEdit, Home, Send, Table2, Users } from "lucide-react";
import Link from "next/link";

type WardMetricTone = "total" | "drafts" | "submitted" | "approved";

const WARD_METRIC_TONES: Record<WardMetricTone, string> = {
  total: "text-brand-navy dark:text-primary",
  drafts: "text-violet-800 dark:text-violet-300",
  submitted: "text-indigo-800 dark:text-indigo-300",
  approved: "text-emerald-700 dark:text-emerald-300",
};

const WARD_METRIC_ICONS: Record<WardMetricTone, LucideIcon> = {
  total: Home,
  drafts: FileEdit,
  submitted: Send,
  approved: CheckCircle2,
};

function wardScopeQuery(row: SurveyWardRow): string {
  const params = new URLSearchParams({ wardNo: row.wardNo });
  if (row.municipalityId) params.set("municipalityId", row.municipalityId);
  return params.toString();
}

function formatWardNo(wardNo: string): string {
  const n = Number.parseInt(wardNo, 10);
  if (!Number.isNaN(n)) return String(n).padStart(2, "0");
  return wardNo;
}

function WardMetric({ label, value, tone }: { label: string; value: number; tone: WardMetricTone }) {
  const Icon = WARD_METRIC_ICONS[tone];
  return (
    <div className="min-w-0 flex-1 text-center">
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 flex items-center justify-center gap-1 text-lg font-bold tabular-nums",
          WARD_METRIC_TONES[tone],
        )}
      >
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function WardCard({ row }: { row: SurveyWardRow }) {
  const wardNoLabel = formatWardNo(row.wardNo);
  const title = row.wardLabel ? `Ward No. ${wardNoLabel} — ${row.wardLabel}` : `Ward No. ${wardNoLabel}`;
  const detailHref = `/surveys/wards/${encodeURIComponent(row.wardNo)}${
    row.municipalityId ? `?municipalityId=${row.municipalityId}` : ""
  }`;
  const surveyorLabel =
    row.activeSurveyorNames.length > 0
      ? row.activeSurveyorNames.slice(0, 2).join(", ") +
        (row.activeSurveyorCount > 2 ? ` +${row.activeSurveyorCount - 2}` : "")
      : "None active";

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border-2 border-indigo-200/70 bg-card shadow-sm transition-shadow duration-200 hover:shadow-md dark:border-indigo-500/25 dark:bg-card/90">
      <header className="flex items-start justify-between gap-2 border-b border-indigo-100/80 bg-linear-to-r from-indigo-50/80 via-indigo-50/40 to-transparent px-4 py-3 dark:border-indigo-500/15 dark:from-indigo-500/10">
        <div className="min-w-0">
          <h3 className="truncate font-display text-sm font-bold text-foreground">{title}</h3>
          {row.city && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{row.city}</p>}
          <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-indigo-800 dark:text-indigo-200">
            <Users className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{surveyorLabel}</span>
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="rounded-lg bg-indigo-600 px-2.5 py-1 font-mono text-sm font-bold tabular-nums text-white dark:bg-indigo-500">
            {row.activeSurveyorCount}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Active</span>
        </div>
      </header>

      <div className="grid grid-cols-2 divide-x divide-y divide-border/50 px-2 py-4 sm:grid-cols-4 sm:divide-y-0">
        <WardMetric label="Total Properties" value={row.total} tone="total" />
        <WardMetric label="Draft Surveys" value={row.drafts} tone="drafts" />
        <WardMetric label="Submitted" value={row.submitted} tone="submitted" />
        <WardMetric label="QC Approved" value={row.qcApproved} tone="approved" />
      </div>

      <footer className="mt-auto flex flex-wrap gap-1.5 border-t border-border/50 bg-muted/20 px-3 py-2.5">
        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-7 flex-1 cursor-pointer rounded-lg border-indigo-200/80 text-xs dark:border-indigo-600/40"
        >
          <Link href={`/surveys/registry?${wardScopeQuery(row)}`}>
            <Table2 className="h-3 w-3" aria-hidden />
            Registry
          </Link>
        </Button>
        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-7 flex-1 cursor-pointer rounded-lg border-indigo-200/80 text-xs dark:border-indigo-600/40"
        >
          <Link href={detailHref}>Ward detail</Link>
        </Button>
      </footer>
    </article>
  );
}

export function SurveyWardCards({ rows, isLoading }: { rows?: SurveyWardRow[]; isLoading?: boolean }) {
  if (isLoading) return <CardsSkeleton count={6} />;
  if (!rows || rows.length === 0) {
    return (
      <EmptyState
        title="No ward data"
        description="Select a municipality or adjust smart filters to see ward-wise survey cards."
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => (
        <WardCard key={`${row.municipalityId ?? ""}:${row.wardNo}`} row={row} />
      ))}
    </div>
  );
}
