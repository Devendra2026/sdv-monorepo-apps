import { DashboardMainSkeleton } from "@/components/layout/dashboard-main-skeleton"
import { DashboardShell } from "@/components/layout/dashboard-shell"
import { isPreloadSkippableError, preloadCurrentUser } from "@/lib/convex-server"
import { auth } from "@clerk/nextjs/server"
import { Suspense } from "react"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await auth.protect()

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
