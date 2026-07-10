import { MastersSection } from "@/app/(dashboard)/masters/masters-section"
import { AdminPageSkeleton } from "@/components/shared/admin-page-skeleton"
import { Suspense } from "react"

export default function MastersPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton variant="tabs" metricCount={3} label="Loading master data" />}>
      <MastersSection />
    </Suspense>
  )
}
