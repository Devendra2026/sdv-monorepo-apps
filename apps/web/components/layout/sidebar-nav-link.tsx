"use client"

import { NAV_ACCENT_CLASS, type NavLeaf, isNavItemActive } from "@/components/layout/nav-config"
import { labelTransition } from "@/components/layout/sidebar-brand"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"

export function SidebarNavLink({
  item,
  active,
  collapsed,
  nested,
  onNavigate,
}: {
  item: NavLeaf
  active?: boolean
  collapsed?: boolean
  nested?: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const isActive = active ?? isNavItemActive(pathname, item.href, item.exact)
  const Icon = item.icon
  const accentClass = NAV_ACCENT_CLASS[item.accent]

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      style={{ "--nav-accent": `var(--section-${item.accent})` } as React.CSSProperties}
      className={cn(
        "theme-transition group relative flex h-9 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium",
        collapsed && "justify-center px-2",
        nested && !collapsed && "pl-9",
        isActive
          ? "nav-link-active shadow-sm"
          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/80 hover:text-sidebar-foreground"
      )}
    >
      <Icon
        className={cn(
          "nav-link-icon h-4 w-4 shrink-0 transition-colors duration-200",
          isActive ? "" : accentClass,
          !isActive && "opacity-80 group-hover:opacity-100"
        )}
        aria-hidden
      />
      <span
        className={cn(
          "truncate whitespace-nowrap",
          labelTransition,
          collapsed ? "max-w-0 opacity-0" : "max-w-40 opacity-100"
        )}
      >
        {item.label}
      </span>
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {item.label}
        </TooltipContent>
      </Tooltip>
    )
  }

  return link
}
