"use client"

import { DashboardActivityView } from "@/app/(dashboard)/dashboard/dashboard-activity-client"
import { useConvexAuthReady } from "@/hooks/use-convex-auth-ready"
import { api } from "@workspace/backend/convex/_generated/api.js"
import { useQuery } from "convex/react"

/** Client-side activity subscription when server preload fails or user is not provisioned yet. */
export function DashboardActivityFallback() {
  const ready = useConvexAuthReady()
  const recentSurveys = useQuery(api.analytics.queries.recentActivity, ready ? {} : "skip")
  return <DashboardActivityView recentSurveys={recentSurveys} />
}
