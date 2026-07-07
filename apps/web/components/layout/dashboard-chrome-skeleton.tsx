import { DashboardSkeleton } from "@/app/(dashboard)/dashboard/dashboard-skeleton"
import { Skeleton } from "@workspace/ui/components/skeleton"

function SidebarRailSkeleton() {
  return (
    <aside className="sidebar-glass hidden h-full w-64 shrink-0 flex-col border-r lg:flex" aria-hidden>
      <div className="flex h-14 items-center gap-3 border-b border-sidebar-border px-4">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-4 w-28 rounded" />
      </div>
      <div className="flex-1 space-y-2 p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full rounded-lg" />
        ))}
      </div>
    </aside>
  )
}

function TopbarSkeleton() {
  return (
    <div className="sticky top-0 z-30 shrink-0 px-3 pt-2 sm:px-4" aria-hidden>
      <header className="topbar-glass flex h-14 items-center gap-2 rounded-2xl px-3 sm:px-4">
        <Skeleton className="h-9 w-9 rounded-xl lg:hidden" />
        <Skeleton className="hidden h-9 max-w-md flex-1 rounded-full sm:block" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-9 w-9 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-full" />
        </div>
      </header>
    </div>
  )
}

/** App chrome + dashboard content skeleton shown during auth/account loading. */
export function DashboardChromeSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden" aria-busy="true" aria-label="Loading dashboard">
      <SidebarRailSkeleton />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <TopbarSkeleton />
        <main className="premium-scrollbar bg-shell min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          <div className="mx-auto w-full max-w-360 space-y-6 p-4 pb-10 sm:p-5 lg:space-y-8 lg:p-8 lg:pb-12">
            <DashboardSkeleton />
          </div>
        </main>
      </div>
    </div>
  )
}
