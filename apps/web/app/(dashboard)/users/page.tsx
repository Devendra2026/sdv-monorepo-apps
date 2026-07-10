import { UsersSection } from "@/app/(dashboard)/users/users-section"
import { AdminPageSkeleton } from "@/components/shared/admin-page-skeleton"
import { Suspense } from "react"

export default function UsersPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton variant="registry" metricCount={4} label="Loading users" />}>
      <UsersSection />
    </Suspense>
  )
}
