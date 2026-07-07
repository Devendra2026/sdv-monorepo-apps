"use client";

import { EmptyState } from "@/components/shared/empty-state";
import { CardsSkeleton } from "@/components/shared/loading";
import { Button } from "@/components/ui/button";
import type { QcWardRow } from "@/lib/qc/ward-stats";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2, ClipboardCheck, Clock3, FileEdit, FileText, Home, Receipt, Table2 } from "lucide-react";
import Link from "next/link";

type WardMetricTone = "pending" | "approved" | "drafts" | "total";

const WARD_METRIC_TONES: Record<WardMetricTone, string> = {
  pending: "text-amber-800 dark:text-amber-200",
  approved: "text-emerald-700 dark:text-emerald-300",
  drafts: "text-violet-800 dark:text-violet-300",
  total: "text-brand-navy dark:text-primary",
};

const WARD_METRIC_ICONS: Record<WardMetricTone, LucideIcon> = {
  pending: Clock3,
  approved: CheckCircle2,
  drafts: FileEdit,
  total: Home,
};

function wardScopeQuery(row: QcWardRow): string {
  const params = new URLSearchParams({ wardNo: row.wardNo });
  if (row.municipalityId) params.set("municipalityId", row.municipalityId);
  return params.toString();
}

function wardHref(path: string, row: QcWardRow): string {
  return `${path}?${wardScopeQuery(row)}`;
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

function WardCard({ row }: { row: QcWardRow }) {
  const wardNoLabel = formatWardNo(row.wardNo);
  const title = row.wardLabel ? `Ward No. ${wardNoLabel} — ${row.wardLabel}` : `Ward No. ${wardNoLabel}`;
  const reportHref = `/qc/wards/${encodeURIComponent(row.wardNo)}${
    row.municipalityId ? `?municipalityId=${row.municipalityId}` : ""
  }`;
  const qcQueue = row.pending + row.approved + row.rejected;

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border-2 border-amber-200/70 bg-card shadow-sm transition-shadow duration-200 hover:shadow-md dark:border-amber-500/25 dark:bg-card/90">
      <header className="flex items-start justify-between gap-2 border-b border-amber-100/80 bg-linear-to-r from-amber-50/80 via-amber-50/40 to-transparent px-4 py-3 dark:border-amber-500/15 dark:from-amber-500/10">
        <div className="min-w-0">
          <h3 className="truncate font-display text-sm font-bold text-foreground">{title}</h3>
          {row.city && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{row.city}</p>}
          {qcQueue > 0 && (
            <p className="mt-1 text-[11px] font-medium text-amber-800 dark:text-amber-200">
              {row.approved.toLocaleString()} approved · {row.pending.toLocaleString()} pending
              {row.qcCompletionPct > 0 ? ` · ${row.qcCompletionPct}% complete` : ""}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="rounded-lg bg-amber-600 px-2.5 py-1 font-mono text-sm font-bold tabular-nums text-white dark:bg-amber-500">
            {row.pending.toLocaleString()}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">QC Pending</span>
        </div>
      </header>

      <div className="grid grid-cols-2 divide-x divide-y divide-border/50 px-2 py-4 sm:grid-cols-4 sm:divide-y-0">
        <WardMetric label="Field Drafts" value={row.drafts} tone="drafts" />
        <WardMetric label="QC Pending" value={row.pending} tone="pending" />
        <WardMetric label="QC Approved" value={row.approved} tone="approved" />
        <WardMetric label="Total Property" value={row.total} tone="total" />
      </div>

      <footer className="mt-auto flex flex-wrap gap-1.5 border-t border-border/50 bg-muted/20 px-3 py-2.5">
        {row.pending > 0 && row.firstPendingId && (
          <Button
            asChild
            size="sm"
            className="h-7 w-full cursor-pointer rounded-lg bg-amber-600 text-xs text-white hover:bg-amber-500"
          >
            <Link href={`/qc/${row.firstPendingId}?${wardScopeQuery(row)}`}>
              <ClipboardCheck className="h-3 w-3" aria-hidden />
              Start QC ({row.pending} pending)
            </Link>
          </Button>
        )}
        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-7 flex-1 cursor-pointer rounded-lg border-amber-200/80 text-xs dark:border-amber-600/40"
        >
          <Link href={wardHref("/qc/registry", row)}>
            <Table2 className="h-3 w-3" aria-hidden />
            Registry
          </Link>
        </Button>
        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-7 flex-1 cursor-pointer rounded-lg border-amber-200/80 text-xs dark:border-amber-600/40"
        >
          <Link href={reportHref}>
            <FileText className="h-3 w-3" aria-hidden />
            Report
          </Link>
        </Button>
        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-7 flex-1 cursor-pointer rounded-lg border-emerald-200/80 text-xs text-emerald-800 dark:border-emerald-700/40 dark:text-emerald-200"
        >
          <Link href={`${reportHref}&tab=demand`}>
            <Receipt className="h-3 w-3" aria-hidden />
            Demand
          </Link>
        </Button>
      </footer>
    </article>
  );
}

export function QcWardCards({ rows, isLoading }: { rows?: QcWardRow[]; isLoading?: boolean }) {
  if (isLoading) return <CardsSkeleton count={6} />;
  if (!rows || rows.length === 0) {
    return (
      <EmptyState
        title="No ward data"
        description="Select a municipality or adjust smart filters to see ward-wise QC cards."
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
