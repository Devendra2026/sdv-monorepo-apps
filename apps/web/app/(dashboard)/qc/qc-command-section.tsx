import { QcCommandClient } from "@/app/(dashboard)/qc/qc-command-client"
import { QcCommandFallback } from "@/app/(dashboard)/qc/qc-command-fallback"
import { isPreloadSkippableError, preloadQcCommandCenterStats } from "@/lib/convex-server"

export async function QcCommandSection({ nowMs }: { nowMs: number }) {
  try {
    const preloadedStats = await preloadQcCommandCenterStats(nowMs)
    return <QcCommandClient nowMs={nowMs} preloadedStats={preloadedStats} />
  } catch (error) {
    if (!isPreloadSkippableError(error)) {
      console.error("[qc] command preload failed", error)
    }
    return <QcCommandFallback />
  }
}
