"use client"

import { NAV_ACCENT_CLASS, type NavGroup, isNavItemActive } from "@/components/layout/nav-config"
import { labelTransition } from "@/components/layout/sidebar-brand"
import { SidebarNavLink } from "@/components/layout/sidebar-nav-link"
import { Button } from "@workspace/ui/components/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@workspace/ui/components/collapsible"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { cn } from "@workspace/ui/lib/utils"
import { ChevronDown } from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

export function SidebarNavGroup({
  group,
  collapsed,
  onNavigate,
}: {
  group: NavGroup
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const childActive = useMemo(
    () => group.children.some((child) => isNavItemActive(pathname, child.href, child.exact)),
    [group.children, pathname]
  )
  const [open, setOpen] = useState(childActive)
  const Icon = group.icon
  const accentClass = NAV_ACCENT_CLASS[group.accent]
  const submenuId = `nav-submenu-${group.key}`

  useEffect(() => {
    if (childActive) setOpen(true)
  }, [childActive])

  if (collapsed) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "theme-transition h-9 w-full justify-center rounded-lg px-2",
              childActive && "bg-sidebar-accent"
            )}
            aria-label={group.label}
            aria-haspopup="menu"
          >
            <Icon className={cn("h-4 w-4 shrink-0", accentClass)} aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" className="w-52 p-1.5">
          <p className="mb-1 px-2 py-1 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            {group.label}
          </p>
          <ul className="space-y-0.5" role="list">
            {group.children.map((child) => (
              <li key={child.key}>
                <SidebarNavLink item={child} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger
        className={cn(
          "theme-transition group flex h-9 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-sm font-medium",
          "text-sidebar-foreground/80 hover:bg-sidebar-accent/80 hover:text-sidebar-foreground",
          childActive && !open && "bg-sidebar-accent/50"
        )}
        aria-expanded={open}
        aria-controls={submenuId}
      >
        <Icon className={cn("nav-link-icon h-4 w-4 shrink-0", accentClass)} aria-hidden />
        <span className={cn("flex-1 truncate text-left", labelTransition)}>{group.label}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-in-out motion-reduce:transition-none",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent id={submenuId} className="nav-submenu-grid">
        <div className="nav-submenu-inner">
          <div className="relative pt-0.5 pb-1">
            <span className="absolute top-1 bottom-1 left-[1.125rem] w-px bg-border/50" aria-hidden />
            <ul className="space-y-0.5" role="list">
              {group.children.map((child) => (
                <li key={child.key}>
                  <SidebarNavLink item={child} nested onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
