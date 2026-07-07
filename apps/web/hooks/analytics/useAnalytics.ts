"use client"

import { useHasCapability } from "@/hooks/use-capability"
import { useClientNowMs } from "@/hooks/use-client-now"
import { useConvexAuthReady } from "@/hooks/use-convex-auth-ready"
import { api } from "@workspace/backend/convex/_generated/api.js"
import type { Id } from "@workspace/backend/convex/_generated/dataModel.js"
import { type Preloaded, usePreloadedQuery, useQuery } from "convex/react"
import { useMemo } from "react"

/** Home dashboard bundle (KPIs + analytics) hydrated from a server `preloadQuery` payload. */
export function useDashboardHomeBundle(preloaded: Preloaded<typeof api.analytics.queries.homeBundle>) {
  return usePreloadedQuery(preloaded)
}

/** Home dashboard KPI counts hydrated from a server `preloadQuery` payload. */
export function useDashboardCounts(preloaded: Preloaded<typeof api.analytics.queries.counts>) {
  return usePreloadedQuery(preloaded)
}

/** Home dashboard analytics hydrated from a server `preloadQuery` payload. */
export function useDashboardAnalytics(preloaded: Preloaded<typeof api.analytics.queries.analyticsBundle>) {
  return usePreloadedQuery(preloaded)
}

/** Activity feed hydrated from a server `preloadQuery` payload. */
export function usePreloadedRecentActivity(preloaded: Preloaded<typeof api.analytics.queries.recentActivity>) {
  return usePreloadedQuery(preloaded)
}

export function useStatsBreakdown(filters: { districtId?: string; municipalityId?: string; surveyorId?: string } = {}) {
  const ready = useConvexAuthReady()
  const allowed = useHasCapability("analytics.view")
  const nowMs = useClientNowMs()
  const queryArgs = useMemo(():
    | "skip"
    | {
        districtId: Id<"districts"> | undefined
        municipalityId: Id<"municipalities"> | undefined
        surveyorId: Id<"users"> | undefined
        nowMs: number
      } => {
    if (!ready || !allowed || !Number.isFinite(nowMs)) return "skip"
    return {
      districtId: filters.districtId as Id<"districts"> | undefined,
      municipalityId: filters.municipalityId as Id<"municipalities"> | undefined,
      surveyorId: filters.surveyorId as Id<"users"> | undefined,
      nowMs,
    }
  }, [ready, allowed, nowMs, filters.districtId, filters.municipalityId, filters.surveyorId])
  return useQuery(api.analytics.queries.surveyStatsBreakdown, queryArgs)
}
