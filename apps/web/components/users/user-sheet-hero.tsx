"use client"

import { USER_ROLE_COLORS, USER_STATUS_COLORS, userAvatarColor, userInitials } from "@/lib/users/display"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { cn, fmtDate } from "@workspace/ui/lib/utils"
import { CalendarDays, Clock } from "lucide-react"

const ROLE_HEADER_GRADIENT: Record<string, string> = {
  admin: "from-violet-500/12 via-card to-violet-500/5 dark:from-violet-500/25 dark:via-card/80 dark:to-violet-500/10",
  supervisor: "from-blue-500/12 via-card to-blue-500/5 dark:from-blue-500/25 dark:via-card/80 dark:to-blue-500/10",
  qc_supervisor:
    "from-amber-500/12 via-card to-amber-500/5 dark:from-amber-500/25 dark:via-card/80 dark:to-amber-500/10",
  surveyor:
    "from-emerald-500/12 via-card to-emerald-500/5 dark:from-emerald-500/25 dark:via-card/80 dark:to-emerald-500/10",
  pending: "from-amber-500/12 via-card to-amber-500/5 dark:from-amber-500/25 dark:via-card/80 dark:to-amber-500/10",
}

export function UserSheetHero({
  name,
  email,
  role,
  status,
  createdAt,
  pending,
}: {
  name: string
  email: string
  role?: string | null
  status?: string | null
  createdAt: number
  pending?: boolean
}) {
  const gradient = role ? (ROLE_HEADER_GRADIENT[role] ?? ROLE_HEADER_GRADIENT.pending) : ROLE_HEADER_GRADIENT.pending

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden border-b border-border/60 bg-linear-to-br px-5 pt-6 pb-5",
        gradient
      )}
    >
      <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-brand-navy/8 blur-2xl dark:bg-brand-navy/20" />
      <div className="relative flex items-start gap-4 pr-10">
        <div className="relative shrink-0">
          <Avatar className="h-14 w-14 shadow-premium-sm ring-2 ring-background/80">
            <AvatarFallback className={cn("text-base font-bold", userAvatarColor(name))}>
              {userInitials(name)}
            </AvatarFallback>
          </Avatar>
          {!pending && status && (
            <span
              className={cn(
                "absolute -right-0.5 -bottom-0.5 h-4 w-4 rounded-full border-2 border-background shadow-sm",
                status === "active" ? "bg-emerald-500" : "bg-red-500"
              )}
              aria-hidden
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg leading-tight font-bold tracking-tight text-foreground">{name}</h2>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{email}</p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {pending ? (
              <Badge
                variant="outline"
                className="rounded-full border-amber-200/80 bg-amber-50 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200"
              >
                <Clock className="mr-1 h-3 w-3" aria-hidden />
                Awaiting approval
              </Badge>
            ) : (
              <>
                {role && (
                  <Badge
                    variant="outline"
                    className={cn("rounded-full text-xs capitalize", USER_ROLE_COLORS[role] ?? "")}
                  >
                    {role}
                  </Badge>
                )}
                {status && (
                  <Badge variant="outline" className={cn("rounded-full text-xs", USER_STATUS_COLORS[status] ?? "")}>
                    {status === "active" ? "Active" : status.replace("_", " ")}
                  </Badge>
                )}
              </>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground ring-1 ring-border/50">
              <CalendarDays className="h-3 w-3" aria-hidden />
              {fmtDate(createdAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
