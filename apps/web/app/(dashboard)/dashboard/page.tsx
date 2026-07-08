import { DashboardContent } from "@/app/(dashboard)/dashboard/dashboard-content"
import { DashboardHeader } from "@/app/(dashboard)/dashboard/dashboard-header"

export default function DashboardPage() {
  const nowMs = Date.now()

  return (
    <div className="space-y-6 lg:space-y-8">
      <DashboardHeader />
      <DashboardContent nowMs={nowMs} />
    </div>
  )
}
