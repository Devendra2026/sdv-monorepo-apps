import { AdminPageSkeleton } from "@/components/shared/admin-page-skeleton"

export default function UsersLoading() {
  return <AdminPageSkeleton variant="registry" metricCount={4} label="Loading users" />
}
