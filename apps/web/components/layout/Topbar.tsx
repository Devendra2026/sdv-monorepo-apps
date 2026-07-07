"use client"

import { CommandPalette } from "@/components/layout/command-palette"
import { SidebarCollapseButton } from "@/components/layout/sidebar-collapse-button"
import { useSidebar } from "@/components/layout/sidebar-context"
import { TopbarNotifications } from "@/components/layout/topbar-notifications"
import { TopbarSearch } from "@/components/layout/topbar-search"
import { TopbarUser } from "@/components/layout/topbar-user"
import { ModeToggle } from "@/components/providers/mode-toggle"
import { Button } from "@workspace/ui/components/button"
import { Menu } from "lucide-react"

export function Topbar() {
  const { toggleMobile } = useSidebar()

  return (
    <>
      <CommandPalette />
      <div className="sticky top-0 z-30 shrink-0 px-3 pt-2 sm:px-4">
        <header className="topbar-glass theme-transition flex h-14 items-center gap-2 rounded-2xl px-3 sm:gap-3 sm:px-4">
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="topbar-action-btn lg:hidden"
              onClick={toggleMobile}
              aria-label="Open navigation menu"
            >
              <Menu className="h-4.5 w-4.5" />
            </Button>
            <SidebarCollapseButton className="topbar-action-btn hidden lg:inline-flex" />
          </div>

          <TopbarSearch />

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            <TopbarNotifications />
            <ModeToggle />
            <div className="mx-1 hidden h-5 w-px bg-border/50 sm:block" aria-hidden />
            <TopbarUser />
          </div>
        </header>
      </div>
    </>
  )
}
