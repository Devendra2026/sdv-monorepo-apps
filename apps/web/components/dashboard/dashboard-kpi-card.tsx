"use client"

import { Card, CardContent } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import type { LucideIcon } from "lucide-react"
import { TrendingDown, TrendingUp } from "lucide-react"

type KpiTone = "neutral" | "muted" | "amber" | "blue" | "emerald" | "destructive"

const toneStyles: Record<KpiTone, { border: string; icon: string }> = {
  neutral: {
    border: "border-l-border",
    icon: "bg-muted text-muted-foreground",
  },
  muted: {
    border: "border-l-muted-foreground/30",
    icon: "bg-muted text-muted-foreground",
  },
  amber: {
    border: "border-l-amber-500",
    icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  blue: {
    border: "border-l-blue-500",
    icon: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  emerald: {
    border: "border-l-emerald-500",
    icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  destructive: {
    border: "border-l-destructive",
    icon: "bg-destructive/10 text-destructive",
  },
}

export function DashboardKpiCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon: Icon,
  trend,
  trendLabel,
  className,
}: {
  label: string
  value: number | string
  hint?: string
  tone?: KpiTone
  icon?: LucideIcon
  trend?: number
  trendLabel?: string
  className?: string
}) {
  const styles = toneStyles[tone]
  const trendUp = trend !== undefined && trend >= 0

  return (
    <Card
      className={cn("rounded-xl border border-border bg-card shadow-sm", "border-l-[3px]", styles.border, className)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[0.65rem] font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
              {typeof value === "number" ? value.toLocaleString() : value}
            </p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
            {trend !== undefined && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                {trendUp ? (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-destructive" aria-hidden />
                )}
                <span
                  className={cn("font-medium", trendUp ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}
                >
                  {trendUp ? "+" : ""}
                  {trend}%
                </span>
                {trendLabel && <span className="text-muted-foreground">{trendLabel}</span>}
              </div>
            )}
          </div>
          {Icon && (
            <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", styles.icon)}>
              <Icon className="h-4 w-4" aria-hidden />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
