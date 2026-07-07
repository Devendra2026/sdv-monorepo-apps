import { auth } from "@clerk/nextjs/server"
import { api } from "@workspace/backend/convex/_generated/api.js"
import { preloadQuery } from "convex/nextjs"

import type { FunctionReference } from "convex/server"
import { cache } from "react"

const convexOptions = {
  skipConvexDeploymentUrlCheck: true,
} as const

/** Preload a Convex query on the server with the signed-in user's Clerk JWT. */
async function preloadConvexQuery<Query extends FunctionReference<"query">>(query: Query, args: Query["_args"]) {
  const { getToken } = await auth()
  const token = await getToken({ template: "convex" })
  return preloadQuery(query, args, { ...convexOptions, token: token ?? undefined })
}

/** Deduped per-request preload for the home dashboard bundle (KPIs + analytics). */
export const preloadDashboardHomeBundle = cache(async (nowMs: number, trendDays = 30) => {
  return preloadConvexQuery(api.analytics.queries.homeBundle, { nowMs, trendDays })
})

/** Deduped per-request preload for dashboard KPI counts only. */
export const preloadDashboardCounts = cache(async (nowMs: number) => {
  return preloadConvexQuery(api.analytics.queries.counts, { nowMs })
})

/** Deduped per-request preload for dashboard analytics charts. */
export const preloadDashboardAnalytics = cache(async (nowMs: number, trendDays = 30) => {
  return preloadConvexQuery(api.analytics.queries.analyticsBundle, { nowMs, trendDays })
})

/** Deduped per-request preload for the home activity feed. */
export const preloadDashboardActivity = cache(async () => {
  return preloadConvexQuery(api.analytics.queries.recentActivity, {})
})
