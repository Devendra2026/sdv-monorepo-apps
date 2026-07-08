"use client"

import { DashboardAccountBoundary } from "@/components/layout/dashboard-account-boundary"
import { Sidebar } from "@/components/layout/Sidebar"
import { SidebarProvider } from "@/components/layout/sidebar-context"
import { Topbar } from "@/components/layout/Topbar"
import { CurrentUserProvider } from "@/lib/current-user-context"
import { api } from "@workspace/backend/convex/_generated/api.js"
import type { Preloaded } from "convex/react"

type Props = {
  children: React.ReactNode
  preloadedUser?: Preloaded<typeof api.users.queries.currentUser>
}

export function DashboardShell({ children, preloadedUser }: Props) {
  return (
    <CurrentUserProvider preloadedUser={preloadedUser}>
      <SidebarProvider>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <Sidebar />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden transition-[margin,padding] duration-300 ease-in-out">
            <Topbar />
            <main className="premium-scrollbar theme-transition bg-shell min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain">
              <DashboardAccountBoundary>{children}</DashboardAccountBoundary>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </CurrentUserProvider>
  )
}
