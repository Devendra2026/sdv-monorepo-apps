"use client"

import { ChartsSkeleton } from "@/app/(dashboard)/dashboard/skeletons"
import type { WebDashboardAnalytics } from "@workspace/schemas"
import dynamic from "next/dynamic"

const DashboardAnalyticsView = dynamic(
  () => import("./dashboard-analytics-view").then((m) => m.DashboardAnalyticsView),
  { loading: () => <ChartsSkeleton />, ssr: false }
)

export function DashboardAnalyticsClient({ analytics }: { analytics: WebDashboardAnalytics | null | undefined }) {
  if (analytics === undefined) {
    return <ChartsSkeleton />
  }

  return <DashboardAnalyticsView analytics={analytics} />
}
