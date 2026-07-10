import { AuditSection } from "@/app/(dashboard)/audit/audit-section"
import { AdminPageSkeleton } from "@/components/shared/admin-page-skeleton"
import { Suspense } from "react"

export default function AuditPage() {
  return (
    <Suspense fallback={<AdminPageSkeleton variant="registry" metricCount={4} label="Loading audit logs" />}>
      <AuditSection />
    </Suspense>
  )
}
