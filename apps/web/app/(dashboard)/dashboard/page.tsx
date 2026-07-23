import { DashboardContent } from "@/app/(dashboard)/dashboard/dashboard-content"
import { DashboardHeader } from "@/app/(dashboard)/dashboard/dashboard-header"
import { bucketNowMs } from "@/lib/now-ms"

export default function DashboardPage() {
  const nowMs = bucketNowMs()

  return (
    <div className="space-y-6 lg:space-y-8">
      <DashboardHeader />
      <DashboardContent nowMs={nowMs} />
    </div>
  )
}
