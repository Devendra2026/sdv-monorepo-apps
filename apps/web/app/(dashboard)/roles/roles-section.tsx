import { RolesClient } from "@/app/(dashboard)/roles/roles-client"
import { AdminPageSkeleton } from "@/components/shared/admin-page-skeleton"
import { isPreloadSkippableError, preloadAdminRolesPage } from "@/lib/convex-server"

export async function RolesSection() {
  try {
    const { preloadedRoles, preloadedPermissions } = await preloadAdminRolesPage()
    return <RolesClient preloadedRoles={preloadedRoles} preloadedPermissions={preloadedPermissions} />
  } catch (error) {
    if (!isPreloadSkippableError(error)) {
      console.error("[roles] preload failed", error)
    }
    return <AdminPageSkeleton variant="master-detail" metricCount={4} label="Loading roles" />
  }
}
