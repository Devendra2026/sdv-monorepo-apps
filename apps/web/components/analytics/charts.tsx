"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { approvalBarClass } from "./chart-theme"

export type WardCoverageItem = {
  wardNo: string
  municipalityName: string
  total: number
  approvalRate: number
}

/** Scrollable ward list — avoids cramped chart axis labels overlapping ward details. */
export function CoverageChart({ data, title }: { data?: WardCoverageItem[]; title: string }) {
  const rows = (data ?? []).slice(0, 20)

  return (
    <Card className="flex h-full min-h-80 flex-col shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="shrink-0 border-b border-border/60 pb-3">
        <CardTitle className="font-display text-base font-semibold tracking-tight">{title}</CardTitle>
        <CardDescription>Surveys per ward · bar color reflects approval rate</CardDescription>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-hidden pt-3">
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No ward data in scope.</p>
        ) : (
          <ul className="scrollbar-thin max-h-[min(22rem,52vh)] space-y-3 overflow-y-auto pr-1 [-ms-overflow-style:none]">
            {rows.map((w) => (
              <li key={`${w.municipalityName}-${w.wardNo}`} className="space-y-1.5">
                <div className="flex items-start gap-2.5">
                  <span
                    className="mt-0.5 inline-flex shrink-0 items-center justify-center rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary tabular-nums dark:bg-primary/20 dark:text-primary-foreground"
                    title={`Ward ${w.wardNo}`}
                  >
                    W{w.wardNo}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm leading-snug font-medium text-foreground" title={w.municipalityName}>
                      {w.municipalityName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {w.total} survey{w.total === 1 ? "" : "s"} · {w.approvalRate}% approved
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums">{w.total}</span>
                </div>
                <div className="ml-12.5 h-2 overflow-hidden rounded-full bg-muted/80">
                  <div
                    className={cn("h-full rounded-full transition-[width]", approvalBarClass(w.approvalRate))}
                    style={{ width: `${w.total > 0 ? Math.max(4, w.approvalRate) : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function MunicipalityPerformanceCard({
  items,
  title = "Municipality Performance",
}: {
  items?: { id: string; name: string; approved: number; total: number }[]
  title?: string
}) {
  return (
    <Card className="flex h-full min-h-80 flex-col shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="shrink-0 border-b border-border/60 pb-3">
        <CardTitle className="font-display text-base font-semibold tracking-tight">{title}</CardTitle>
        <CardDescription>Approval share within each ULB</CardDescription>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-hidden pt-3">
        {!items?.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No data in scope.</p>
        ) : (
          <ul className="scrollbar-thin max-h-[min(22rem,52vh)] space-y-4 overflow-y-auto pr-1">
            {items.map((m) => {
              const rate = m.total > 0 ? Math.round((m.approved / m.total) * 100) : 0
              return (
                <li key={m.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-medium text-foreground" title={m.name}>
                      {m.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {m.approved}/{m.total} · {rate}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted/80">
                    <div
                      className={cn("h-full rounded-full transition-[width]", approvalBarClass(rate))}
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
