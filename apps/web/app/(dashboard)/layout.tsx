import { DashboardMainSkeleton } from "@/components/layout/dashboard-main-skeleton"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { isPreloadSkippableError, preloadCurrentUser } from "@/lib/convex-server"
import { Suspense } from "react"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let preloadedUser
  try {
    preloadedUser = await preloadCurrentUser()
  } catch (error) {
    if (!isPreloadSkippableError(error)) {
      console.error("[dashboard] currentUser preload failed", error)
    }
  }

  return (
    <DashboardShell preloadedUser={preloadedUser}>
      <Suspense fallback={<DashboardMainSkeleton />}>{children}</Suspense>
    </DashboardShell>
  )
}
