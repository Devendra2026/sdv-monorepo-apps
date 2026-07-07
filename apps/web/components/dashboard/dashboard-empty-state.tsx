import type { LucideIcon } from "lucide-react"
import { Inbox } from "lucide-react"
import type { ReactNode } from "react"

export function DashboardEmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  compact = false,
}: {
  title: string
  description?: string
  icon?: LucideIcon
  action?: ReactNode
  compact?: boolean
}) {
  return (
    <div
      className={
        compact
          ? "flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-4 py-10 text-center"
          : "flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-4 py-12 text-center"
      }
    >
      <Icon className="mb-3 h-7 w-7 text-muted-foreground/60" aria-hidden />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
