import { UsersClient } from "@/app/(dashboard)/users/users-client"
import { AdminPageSkeleton } from "@/components/shared/admin-page-skeleton"
import {
  isPreloadSkippableError,
  preloadAdminActiveUserCount,
  preloadAdminAssignableRoles,
  preloadAdminDisabledUserCount,
  preloadAdminPendingApprovals,
  preloadAdminUsersPage,
} from "@/lib/convex-server"

export async function UsersSection() {
  try {
    const [preloadedPending, preloadedRoles, preloadedActiveCount, preloadedDisabledCount, preloadedUsersPage] =
      await Promise.all([
        preloadAdminPendingApprovals(),
        preloadAdminAssignableRoles(),
        preloadAdminActiveUserCount(),
        preloadAdminDisabledUserCount(),
        preloadAdminUsersPage(),
      ])

    return (
      <UsersClient
        preloadedPending={preloadedPending}
        preloadedRoles={preloadedRoles}
        preloadedActiveCount={preloadedActiveCount}
        preloadedDisabledCount={preloadedDisabledCount}
        preloadedUsersPage={preloadedUsersPage}
      />
    )
  } catch (error) {
    if (!isPreloadSkippableError(error)) {
      console.error("[users] preload failed", error)
    }
    return <AdminPageSkeleton variant="registry" metricCount={4} label="Loading users" />
  }
}
