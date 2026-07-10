import { RolesSection } from "@/app/(dashboard)/roles/roles-section"
import { AdminPageSkeleton } from "@/components/shared/admin-page-skeleton"
import { Suspense } from "react"

export default function RolesPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton variant="master-detail" metricCount={4} label="Loading roles" />}>
      <RolesSection />
    </Suspense>
  )
}
