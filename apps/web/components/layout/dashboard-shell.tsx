"use client"

import { DashboardAccountBoundary } from "@/components/layout/dashboard-account-boundary"
import { DashboardMainSkeleton } from "@/components/layout/dashboard-main-skeleton"
import { Sidebar } from "@/components/layout/Sidebar"
import { SidebarProvider } from "@/components/layout/sidebar-context"
import { Topbar } from "@/components/layout/Topbar"
import { CurrentUserProvider } from "@/lib/current-user-context"
import { Authenticated, AuthLoading } from "convex/react"

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <CurrentUserProvider>
      <SidebarProvider>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <Sidebar />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden transition-[margin,padding] duration-300 ease-in-out">
            <Topbar />
            <main className="premium-scrollbar theme-transition bg-shell min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain">
              <AuthLoading>
                <DashboardMainSkeleton />
              </AuthLoading>
              <Authenticated>
                <DashboardAccountBoundary>{children}</DashboardAccountBoundary>
              </Authenticated>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </CurrentUserProvider>
  )
}
