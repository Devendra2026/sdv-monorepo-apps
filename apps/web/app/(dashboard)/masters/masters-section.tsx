import { MastersClient } from "@/app/(dashboard)/masters/masters-client"
import { AdminPageSkeleton } from "@/components/shared/admin-page-skeleton"
import { isPreloadSkippableError, preloadAdminTenants } from "@/lib/convex-server"

export async function MastersSection() {
  try {
    const preloadedTenants = await preloadAdminTenants()
    return <MastersClient preloadedTenants={preloadedTenants} />
  } catch (error) {
    if (!isPreloadSkippableError(error)) {
      console.error("[masters] preload failed", error)
    }
    return <AdminPageSkeleton variant="tabs" metricCount={3} label="Loading master data" />
  }
}
