"use client"

import { DashboardActivityView } from "@/app/(dashboard)/dashboard/dashboard-activity-client"
import { usePreloadedRecentActivity } from "@/hooks/analytics/useAnalytics"
import { api } from "@workspace/backend/convex/_generated/api.js"
import type { Preloaded } from "convex/react"

export function DashboardActivityPreloaded({
  preloadedActivity,
}: {
  preloadedActivity: Preloaded<typeof api.analytics.queries.recentActivity>
}) {
  const recentSurveys = usePreloadedRecentActivity(preloadedActivity)
  return <DashboardActivityView recentSurveys={recentSurveys} />
}
