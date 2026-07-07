import { DashboardSkeleton } from "@/app/(dashboard)/dashboard/dashboard-skeleton"

/** Main content area skeleton — sidebar and topbar remain visible. */
export function DashboardMainSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-360 space-y-6 p-4 pb-10 sm:p-5 lg:space-y-8 lg:p-8 lg:pb-12"
      aria-busy="true"
      aria-label="Loading dashboard content"
    >
      <DashboardSkeleton />
    </div>
  )
}
