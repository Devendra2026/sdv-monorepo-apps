"use client"

import { useSidebar } from "@/components/layout/sidebar-context"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

export function SidebarCollapseButton({ className }: { className?: string }) {
  const { collapsed, toggleCollapsed } = useSidebar()

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleCollapsed}
      className={cn(
        "topbar-action-btn relative overflow-hidden",
        className
      )}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-expanded={!collapsed}
    >
      <PanelLeftClose
        className={cn(
          "absolute h-4 w-4 transition-all duration-300 ease-in-out motion-reduce:transition-none",
          collapsed ? "scale-75 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"
        )}
        aria-hidden
      />
      <PanelLeftOpen
        className={cn(
          "absolute h-4 w-4 transition-all duration-300 ease-in-out motion-reduce:transition-none",
          collapsed ? "scale-100 rotate-0 opacity-100" : "scale-75 -rotate-90 opacity-0"
        )}
        aria-hidden
      />
    </Button>
  )
}
