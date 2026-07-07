"use client";

import { GlassCard } from "@/components/design-system/glass-card";
import { cn } from "@workspace/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";

type MetricTone = "default" | "success" | "warning" | "destructive" | "info" | "ai" | "muted";

const toneStyles: Record<MetricTone, { border: string; icon: string; glow: string }> = {
  default: {
    border: "border-l-primary",
    icon: "bg-primary/10 text-primary",
    glow: "from-primary/20",
  },
  success: {
    border: "border-l-emerald-500",
    icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    glow: "from-emerald-500/20",
  },
  warning: {
    border: "border-l-amber-500",
    icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    glow: "from-amber-500/20",
  },
  destructive: {
    border: "border-l-rose-500",
    icon: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    glow: "from-rose-500/20",
  },
  info: {
    border: "border-l-brand-navy",
    icon: "bg-brand-navy/10 text-brand-navy dark:text-primary",
    glow: "from-brand-navy/20",
  },
  ai: {
    border: "border-l-brand-red",
    icon: "bg-brand-red/10 text-brand-red",
    glow: "from-brand-red/20",
  },
  muted: {
    border: "border-l-muted-foreground/30",
    icon: "bg-muted text-muted-foreground",
    glow: "from-muted-foreground/10",
  },
};

export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
  icon: Icon,
  trend,
  trendLabel,
  className,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: MetricTone;
  icon?: LucideIcon;
  trend?: number;
  trendLabel?: string;
  className?: string;
}) {
  const styles = toneStyles[tone];
  const trendUp = trend !== undefined && trend >= 0;

  return (
    <GlassCard padding="md" hover className={cn("border-l-[3px]", styles.border, className)}>
      <div
        className={cn(
          "pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-linear-to-br to-transparent opacity-60 blur-2xl",
          styles.glow,
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums tracking-tight text-foreground">
            {value}
          </p>
          {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
          {trend !== undefined && (
            <div className="mt-2 flex items-center gap-1.5 text-xs">
              {trendUp ? (
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-rose-500" aria-hidden />
              )}
              <span
                className={cn(
                  "font-medium",
                  trendUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
                )}
              >
                {trendUp ? "+" : ""}
                {trend}%
              </span>
              {trendLabel && <span className="text-muted-foreground">{trendLabel}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", styles.icon)}>
            <Icon className="h-5 w-5" aria-hidden />
          </div>
        )}
      </div>
    </GlassCard>
  );
}
