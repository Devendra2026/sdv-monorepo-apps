import { AdminPageSkeleton } from "@/components/shared/admin-page-skeleton"

export default function AuditLoading() {
  return <AdminPageSkeleton variant="registry" metricCount={4} label="Loading audit logs" />
}
