"use client"

import { SidebarBrand } from "@/components/layout/sidebar-brand"
import { useSidebar } from "@/components/layout/sidebar-context"
import { SidebarNav } from "@/components/layout/sidebar-nav"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import { cn } from "@workspace/ui/lib/utils"

export function Sidebar() {
  const { collapsed, mobileOpen, setMobileOpen } = useSidebar()

  return (
    <>
      <aside
        className={cn(
          "sidebar-shell sidebar-glass theme-transition hidden h-full min-h-0 shrink-0 flex-col overflow-hidden border-r lg:flex",
          collapsed ? "w-16" : "w-64"
        )}
        aria-label="Sidebar"
        data-collapsed={collapsed}
      >
        <SidebarBrand collapsed={collapsed} />
        <SidebarNav collapsed={collapsed} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="sidebar-glass w-72 border-sidebar-border p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Main application navigation links.</SheetDescription>
          </SheetHeader>
          <SidebarBrand />
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  )
}
