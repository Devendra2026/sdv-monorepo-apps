import { DashboardActivitySection } from "@/app/(dashboard)/dashboard/dashboard-activity-section"
import { DashboardHeader } from "@/app/(dashboard)/dashboard/dashboard-header"
import { DashboardHomeSection } from "@/app/(dashboard)/dashboard/dashboard-home-section"
import { DashboardActivitySkeleton, DashboardHomeSkeleton } from "@/app/(dashboard)/dashboard/dashboard-skeleton"
import { Suspense } from "react"

export default function DashboardPage() {
  const nowMs = Date.now()

  return (
    <div className="space-y-6 lg:space-y-8">
      <DashboardHeader nowMs={nowMs} />

      <Suspense fallback={<DashboardHomeSkeleton />}>
        <DashboardHomeSection nowMs={nowMs} />
      </Suspense>

      <Suspense fallback={<DashboardActivitySkeleton />}>
        <DashboardActivitySection />
      </Suspense>
    </div>
  )
}
