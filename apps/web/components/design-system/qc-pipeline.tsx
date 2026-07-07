"use client";

import { GlassCard, GlassCardHeader } from "@/components/design-system/glass-card";
import { cn } from "@workspace/ui/lib/utils";
import { CheckCircle2, Clock3, FileCheck, GitBranch, XCircle } from "lucide-react";

type PipelineStage = {
  id: string;
  label: string;
  count: number;
  icon: React.ElementType;
  color: string;
};

export function QcPipeline({
  pending,
  inReview,
  approved,
  rejected,
  activeStage,
  onStageClick,
  className,
}: {
  pending: number;
  inReview?: number;
  approved: number;
  rejected: number;
  activeStage?: string;
  onStageClick?: (stageId: string) => void;
  className?: string;
}) {
  const stages: PipelineStage[] = [
    {
      id: "pending",
      label: "Pending",
      count: pending,
      icon: Clock3,
      color: "text-amber-950 dark:text-amber-200 bg-warning/12 border-warning/40",
    },
    {
      id: "review",
      label: "In Review",
      count: inReview ?? 0,
      icon: GitBranch,
      color: "text-brand-navy dark:text-primary bg-brand-navy/10 border-brand-navy/25 dark:border-primary/30",
    },
    {
      id: "approved",
      label: "Approved",
      count: approved,
      icon: CheckCircle2,
      color: "text-emerald-800 dark:text-emerald-300 bg-success/12 border-success/35",
    },
    {
      id: "rejected",
      label: "Returned",
      count: rejected,
      icon: XCircle,
      color: "text-brand-red bg-brand-red/10 border-brand-red/35",
    },
  ];

  const total = pending + (inReview ?? 0) + approved + rejected || 1;

  return (
    <GlassCard padding="md" className={className}>
      <GlassCardHeader
        title="QC Workflow Pipeline"
        description="Click a stage to filter the review queue"
        icon={<FileCheck className="h-4 w-4" aria-hidden />}
      />
      <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4" aria-label="QC pipeline stages">
        {stages.map((stage, i) => {
          const Icon = stage.icon;
          const pct = Math.round((stage.count / total) * 100);
          const isActive = activeStage === stage.id || (stage.id === "rejected" && activeStage === "rejected");
          const tabKey =
            stage.id === "pending"
              ? "pending"
              : stage.id === "approved"
                ? "approved"
                : stage.id === "rejected"
                  ? "rejected"
                  : "all";
          const interactive = onStageClick && stage.id !== "review";

          const inner = (
            <>
              <div className="flex items-center justify-between">
                <Icon className="h-5 w-5" aria-hidden />
                <span className="font-mono text-2xl font-bold tabular-nums">{stage.count}</span>
              </div>
              <p className="mt-2 text-xs font-bold uppercase tracking-wider">{stage.label}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background/50">
                <progress
                  className="h-full w-full appearance-none rounded-full bg-transparent [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-current [&::-webkit-progress-value]:opacity-60"
                  value={pct}
                  max={100}
                  aria-label={`${stage.label} ${pct}%`}
                />
              </div>
            </>
          );

          return (
            <li key={stage.id}>
              {interactive ? (
                <button
                  type="button"
                  onClick={() => onStageClick(tabKey)}
                  aria-pressed={isActive}
                  className={cn(
                    "w-full cursor-pointer rounded-xl border p-4 text-left transition-all duration-200 hover:shadow-premium-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40 dark:focus-visible:ring-primary/50",
                    stage.color,
                    isActive && "ring-2 ring-brand-navy/30 shadow-premium-sm dark:ring-primary/40",
                  )}
                >
                  {inner}
                </button>
              ) : (
                <div className={cn("rounded-xl border p-4 transition-all duration-200", stage.color)}>{inner}</div>
              )}
              {i < stages.length - 1 && <div className="mx-auto mt-2 hidden h-px w-8 bg-border lg:block" aria-hidden />}
            </li>
          );
        })}
      </ul>
    </GlassCard>
  );
}

function QcReviewTimeline({
  events,
  className,
}: {
  events: Array<{ id: string; label: string; timestamp?: number; status: "done" | "current" | "pending" }>;
  className?: string;
}) {
  return (
    <GlassCard padding="md" className={className}>
      <GlassCardHeader title="Review Timeline" description="QC decision progression" />
      <ol className="relative space-y-0" aria-label="QC review timeline">
        {events.map((event, i) => (
          <li key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
            {i < events.length - 1 && (
              <span
                className={cn(
                  "absolute left-2.75 top-6 h-full w-px",
                  event.status === "done" ? "bg-primary/40" : "bg-border",
                )}
                aria-hidden
              />
            )}
            <div
              className={cn(
                "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold",
                event.status === "done" && "border-primary bg-primary text-primary-foreground",
                event.status === "current" && "border-primary bg-primary/10 text-primary",
                event.status === "pending" && "border-border bg-muted text-muted-foreground",
              )}
              aria-current={event.status === "current" ? "step" : undefined}
            >
              {i + 1}
            </div>
            <div className="min-w-0 pt-0.5">
              <p className={cn("text-sm font-medium", event.status === "pending" && "text-muted-foreground")}>
                {event.label}
              </p>
              {event.timestamp && (
                <time className="text-xs text-muted-foreground" dateTime={new Date(event.timestamp).toISOString()}>
                  {new Date(event.timestamp).toLocaleString()}
                </time>
              )}
            </div>
          </li>
        ))}
      </ol>
    </GlassCard>
  );
}
