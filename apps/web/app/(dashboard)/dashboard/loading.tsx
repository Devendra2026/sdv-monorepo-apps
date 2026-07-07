import { DashboardHeaderSkeleton, DashboardSectionsSkeleton } from "@/app/(dashboard)/dashboard/dashboard-skeleton"

export default function DashboardLoading() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <DashboardHeaderSkeleton />
      <DashboardSectionsSkeleton />
    </div>
  )
}
