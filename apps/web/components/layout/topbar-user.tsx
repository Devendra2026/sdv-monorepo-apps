"use client"

import { USER_ROLE_LABEL, type UserRole } from "@/lib/domain"
import type { Role } from "@/lib/permissions"
import { useCurrentUser } from "@/lib/sessions"
import { SignOutButton, useUser } from "@clerk/nextjs"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { cn } from "@workspace/ui/lib/utils"
import { LogOut, Settings } from "lucide-react"
import Link from "next/link"

function roleLabel(role: Role | undefined): string {
  if (!role) return ""
  return USER_ROLE_LABEL[role as UserRole] ?? role
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase()
}

export function TopbarUser() {
  const { user, role } = useCurrentUser()
  const { user: clerkUser } = useUser()
  const displayName = user?.name ?? clerkUser?.fullName ?? "Account"
  const email = user?.email ?? clerkUser?.primaryEmailAddress?.emailAddress ?? ""
  const avatarUrl = clerkUser?.imageUrl

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "topbar-profile-chip theme-transition flex cursor-pointer items-center gap-2 rounded-full py-1 pr-2.5 pl-1",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          )}
          aria-label="Open profile menu"
        >
          <Avatar className="h-8 w-8">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="hidden min-w-0 text-left sm:block">
            <p className="max-w-[8rem] truncate text-sm leading-tight font-medium text-foreground">{displayName}</p>
            {role && (
              <p className="truncate text-[10px] text-muted-foreground">{roleLabel(role)}</p>
            )}
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="topbar-panel w-56 rounded-2xl p-1">
        <DropdownMenuLabel className="px-2 py-2 font-normal">
          <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
          {email && <p className="truncate text-xs text-muted-foreground">{email}</p>}
          {role && (
            <Badge variant="secondary" className="mt-2 h-5 px-2 text-[10px] font-medium">
              {roleLabel(role)}
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border/50" />
        <DropdownMenuItem asChild className="cursor-pointer rounded-lg">
          <Link href="/settings" className="gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" aria-hidden />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-border/50" />
        <SignOutButton>
          <DropdownMenuItem className="cursor-pointer gap-2 rounded-lg text-destructive focus:text-destructive">
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </DropdownMenuItem>
        </SignOutButton>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
