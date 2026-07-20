"use client"

import { ChartsSkeleton } from "@/app/(dashboard)/dashboard/skeletons"
import type { WebDashboardAnalytics, WebDashboardQcSupervisors } from "@workspace/schemas"
import dynamic from "next/dynamic"

const DashboardAnalyticsView = dynamic(
  () => import("./dashboard-analytics-view").then((m) => m.DashboardAnalyticsView),
  { loading: () => <ChartsSkeleton />, ssr: false }
)

export function DashboardAnalyticsClient({
  analytics,
  qcSupervisors,
}: {
  analytics: WebDashboardAnalytics | null | undefined
  qcSupervisors?: WebDashboardQcSupervisors | null
}) {
  if (analytics === undefined) {
    return <ChartsSkeleton />
  }

  return <DashboardAnalyticsView analytics={analytics} qcSupervisors={qcSupervisors ?? null} />
}
