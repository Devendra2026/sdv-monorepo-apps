import { SidebarRailSkeleton, TopbarSkeleton } from "@/components/layout/dashboard-chrome-skeleton"
import { DashboardMainSkeleton } from "@/components/layout/dashboard-main-skeleton"

/** Route-group loading UI — chrome skeleton streams instantly, main content shows shimmer. */
export default function DashboardGroupLoading() {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden" aria-busy="true" aria-label="Loading dashboard">
      <SidebarRailSkeleton />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <TopbarSkeleton />
        <main className="premium-scrollbar theme-transition bg-shell min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain">
          <DashboardMainSkeleton />
        </main>
      </div>
    </div>
  )
}
