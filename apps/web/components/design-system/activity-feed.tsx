"use client"

import { GlassCard, GlassCardHeader } from "@/components/design-system/glass-card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { fmtDate } from "@workspace/ui/lib/utils"
import { Activity, CheckCircle2, ClipboardList, ShieldCheck, UserPlus } from "lucide-react"

type ActivityItem = {
  id: string
  type: "survey" | "qc" | "approval" | "user"
  title: string
  subtitle?: string
  timestamp: number
}

const typeIcons = {
  survey: ClipboardList,
  qc: ShieldCheck,
  approval: CheckCircle2,
  user: UserPlus,
}

const typeColors = {
  survey: "bg-brand-navy/10 text-brand-navy dark:text-primary",
  qc: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  approval: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  user: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
}

export function ActivityFeed({
  items,
  loading,
  className,
  bare = false,
}: {
  items: ActivityItem[]
  loading?: boolean
  className?: string
  bare?: boolean
}) {
  const body = loading ? (
    <div className="space-y-3" aria-busy="true" aria-label="Loading activity">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  ) : items.length === 0 ? (
    <p className="text-sm text-muted-foreground">No recent activity in scope.</p>
  ) : (
    <ul className="space-y-1" aria-label="Recent activity">
      {items.map((item) => {
        const Icon = typeIcons[item.type]
        return (
          <li
            key={item.id}
            className="flex cursor-default items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/40"
          >
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${typeColors[item.type]}`}>
              <Icon className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {item.subtitle && <span className="truncate">{item.subtitle}</span>}
                {item.subtitle && <span aria-hidden>·</span>}
                <time dateTime={new Date(item.timestamp).toISOString()}>{fmtDate(item.timestamp)}</time>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )

  if (bare) {
    return <div className={className}>{body}</div>
  }

  return (
    <GlassCard padding="md" className={className}>
      <GlassCardHeader
        title="Activity Feed"
        description="Recent survey and QC events"
        icon={<Activity className="h-4 w-4" aria-hidden />}
      />
      {body}
    </GlassCard>
  )
}
