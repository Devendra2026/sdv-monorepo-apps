"use client"

import { useMarkAllRead, useMarkRead, useNotifications, useUnreadCount } from "@/hooks/masters/useNotifications"
import type { Doc } from "@workspace/backend/convex/_generated/dataModel.js"
import { Button } from "@workspace/ui/components/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn, fmtDate } from "@workspace/ui/lib/utils"
import { Bell, Check, Inbox } from "lucide-react"
import { useEffect, useRef, useState } from "react"

type NotificationDoc = Doc<"notifications">

function NotificationSkeleton() {
  return (
    <div className="space-y-3 px-4 py-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-3/4 rounded" />
          <Skeleton className="h-3 w-full rounded" />
        </div>
      ))}
    </div>
  )
}

export function TopbarNotifications() {
  const [enabled, setEnabled] = useState(false)
  const [ringBell, setRingBell] = useState(false)
  const prevUnread = useRef(0)

  useEffect(() => {
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(() => setEnabled(true))
      return () => cancelIdleCallback(id)
    }
    const timer = window.setTimeout(() => setEnabled(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const unread = useUnreadCount(enabled)
  const notifications = useNotifications(20, enabled)
  const markAll = useMarkAllRead()
  const markRead = useMarkRead()

  useEffect(() => {
    if (unread > prevUnread.current && unread > 0) {
      setRingBell(true)
      const timer = window.setTimeout(() => setRingBell(false), 650)
      prevUnread.current = unread
      return () => clearTimeout(timer)
    }
    prevUnread.current = unread
  }, [unread])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="topbar-action-btn relative"
          aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
        >
          <Bell className={cn("h-[1.125rem] w-[1.125rem]", ringBell && "motion-safe:animate-bell-ring")} />
          {unread > 0 && (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-red px-1",
                "text-[10px] font-semibold text-white shadow-sm transition-transform duration-200",
                ringBell && "motion-safe:scale-110"
              )}
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="topbar-panel w-80 rounded-2xl p-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">
            Notifications
            {unread > 0 && (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">({unread})</span>
            )}
          </DropdownMenuLabel>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 gap-1 px-2 text-xs text-muted-foreground"
              onClick={() => markAll({})}
            >
              <Check className="h-3 w-3" aria-hidden />
              Mark all read
            </Button>
          )}
        </div>
        <div className="premium-scrollbar max-h-96 divide-y divide-border/50 overflow-y-auto border-t border-border/50">
          {notifications === undefined && <NotificationSkeleton />}
          {notifications?.length === 0 && (
            <div className="flex flex-col items-center px-4 py-12 text-center">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted/60">
                <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden />
              </div>
              <p className="text-sm font-medium text-foreground">All caught up</p>
              <p className="mt-1 text-xs text-muted-foreground">No new notifications.</p>
            </div>
          )}
          {notifications?.map((n: NotificationDoc) => (
            <button
              type="button"
              key={n._id}
              onClick={() => !n.readAt && markRead({ id: n._id })}
              className={cn(
                "theme-transition w-full px-4 py-3 text-left hover:bg-muted/40",
                n.readAt ? "opacity-55" : "bg-muted/20"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-sm font-medium text-foreground">{n.title}</p>
                {!n.readAt && (
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-section-violet" aria-hidden />
                )}
              </div>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
              <time
                className="mt-1.5 block text-[10px] text-muted-foreground/80"
                dateTime={new Date(n._creationTime).toISOString()}
              >
                {fmtDate(n._creationTime)}
              </time>
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
