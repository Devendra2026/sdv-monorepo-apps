import { QcRegistryClient } from "@/app/(dashboard)/qc/registry/qc-registry-client"
import { QcRegistryFallback } from "@/app/(dashboard)/qc/registry/qc-registry-fallback"
import { isPreloadSkippableError, preloadQcCommandCenterStats } from "@/lib/convex-server"

export async function QcRegistrySection({ nowMs }: { nowMs: number }) {
  try {
    const preloadedStats = await preloadQcCommandCenterStats(nowMs)
    return <QcRegistryClient preloadedStats={preloadedStats} />
  } catch (error) {
    if (!isPreloadSkippableError(error)) {
      console.error("[qc] registry preload failed", error)
    }
    return <QcRegistryFallback />
  }
}
