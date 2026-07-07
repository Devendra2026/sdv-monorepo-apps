"use client"

import { DashboardActivityView } from "@/app/(dashboard)/dashboard/dashboard-activity-client"
import { api } from "@workspace/backend/convex/_generated/api.js"
import { useQuery } from "convex/react"

/** Client-side activity subscription when server preload fails. */
export function DashboardActivityFallback() {
  const recentSurveys = useQuery(api.analytics.queries.recentActivity, {})
  return <DashboardActivityView recentSurveys={recentSurveys} />
}
