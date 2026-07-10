import { actionStyle, avatarColor, entityColor, initials, relativeTime } from "@/components/audit/audit-helpers"
import { EmptyState } from "@/components/shared/empty-state"
import { TableSkeleton } from "@/components/shared/loading"
import { useVirtualizer } from "@tanstack/react-virtual"
import type { AuditEntry } from "@workspace/schemas/audit/index"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { cn, fmtDate } from "@workspace/ui/lib/utils"
import { Bot, ScrollText } from "lucide-react"
import { memo, useRef } from "react"

const VIRTUALIZE_ROW_THRESHOLD = 50
const TIMELINE_ROW_HEIGHT = 132

const AuditRow = memo(function AuditRow({ entry, isLast }: { entry: AuditEntry; isLast: boolean }) {
  const style = actionStyle(entry.action)
  const Icon = style.icon
  const actorName = entry.actor?.name ?? "System"
  const isSystem = !entry.actor

  return (
    <div className="group flex gap-4 px-5 py-4 transition-colors hover:bg-muted/30 sm:gap-5 sm:py-5">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-black/5 transition-transform group-hover:scale-105 dark:ring-white/10",
            style.bg
          )}
        >
          <Icon className={cn("h-4 w-4", style.text)} />
        </div>
        {!isLast && <div className="mt-2 w-px flex-1 bg-border/80" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="font-mono text-sm leading-snug font-semibold tracking-tight text-foreground">
              {entry.action}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn("text-[11px] font-medium", entityColor(entry.entity))}>
                {entry.entity}
              </Badge>
              {entry.entityId && (
                <span className="max-w-50 truncate rounded-md bg-muted/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground sm:max-w-xs">
                  {entry.entityId}
                </span>
              )}
            </div>
          </div>

          <div className="shrink-0 text-left sm:text-right">
            <p className="text-xs font-medium text-foreground">{relativeTime(entry._creationTime)}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{fmtDate(entry._creationTime)}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2.5">
          {isSystem ? (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
              <Bot className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          ) : (
            <Avatar className="h-7 w-7">
              <AvatarFallback className={cn("text-[10px] font-semibold", avatarColor(actorName))}>
                {initials(actorName)}
              </AvatarFallback>
            </Avatar>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm leading-none font-medium">{actorName}</p>
            {entry.actor?.email && (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{entry.actor.email}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

function VirtualizedAuditTimeline({ rows }: { rows: AuditEntry[] }) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => TIMELINE_ROW_HEIGHT,
    overscan: 8,
  })

  return (
    <div ref={parentRef} className="max-h-[min(70vh,960px)] overflow-y-auto">
      <div className="relative divide-y divide-border" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const entry = rows[virtualRow.index]
          if (!entry) return null
          return (
            <div
              key={entry._id}
              className="absolute top-0 left-0 w-full"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <AuditRow entry={entry} isLast={virtualRow.index === rows.length - 1} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Renders an audit feed. Reused by the Audit page and the survey detail
 *  "Audit History" tab. */
export function AuditTable({
  rows,
  compact = false,
  skeletonRows = 10,
}: {
  rows?: AuditEntry[]
  compact?: boolean
  skeletonRows?: number
}) {
  if (rows === undefined) return <TableSkeleton rows={compact ? 4 : skeletonRows} />
  if (rows.length === 0)
    return (
      <EmptyState
        title="No audit entries"
        description="Activity will appear here as users make changes across the system."
        icon={ScrollText}
      />
    )

  if (compact) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Actor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((a) => (
            <TableRow key={a._id}>
              <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDate(a._creationTime)}</TableCell>
              <TableCell className="font-mono text-xs">{a.action}</TableCell>
              <TableCell>{a.actor?.name ?? "System"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  if (rows.length >= VIRTUALIZE_ROW_THRESHOLD) {
    return <VirtualizedAuditTimeline rows={rows} />
  }

  return (
    <div className="divide-y divide-border">
      {rows.map((entry, i) => (
        <AuditRow key={entry._id} entry={entry} isLast={i === rows.length - 1} />
      ))}
    </div>
  )
}
