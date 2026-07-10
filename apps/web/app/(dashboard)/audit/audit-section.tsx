import { AuditClient } from "@/app/(dashboard)/audit/audit-client"
import { AdminPageSkeleton } from "@/components/shared/admin-page-skeleton"
import { isPreloadSkippableError, preloadAdminAuditPage } from "@/lib/convex-server"

export async function AuditSection() {
  const nowMs = Date.now()
  try {
    const { preloadedRows, preloadedSummary, preloadedFacets } = await preloadAdminAuditPage(nowMs)
    return (
      <AuditClient
        preloadedRows={preloadedRows}
        preloadedSummary={preloadedSummary}
        preloadedFacets={preloadedFacets}
        nowMs={nowMs}
      />
    )
  } catch (error) {
    if (!isPreloadSkippableError(error)) {
      console.error("[audit] preload failed", error)
    }
    return <AdminPageSkeleton variant="registry" metricCount={4} label="Loading audit logs" />
  }
}
