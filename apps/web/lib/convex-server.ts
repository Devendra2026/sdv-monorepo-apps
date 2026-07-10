import { CLERK_CONVEX_JWT_TEMPLATE } from "@/lib/clerk-convex"
import { auth } from "@clerk/nextjs/server"
import { api } from "@workspace/backend/convex/_generated/api.js"
import type { Id } from "@workspace/backend/convex/_generated/dataModel.js"
import { preloadQuery } from "convex/nextjs"

import type { FunctionReference } from "convex/server"
import { cache } from "react"

const convexOptions = {
  skipConvexDeploymentUrlCheck: true,
} as const

/** Thrown when server preload cannot obtain a Clerk JWT for Convex. */
export class ClerkConvexTokenUnavailableError extends Error {
  constructor() {
    super("Clerk Convex JWT unavailable")
    this.name = "ClerkConvexTokenUnavailableError"
  }
}

/** True when Clerk has no JWT template named `convex` (404 from Clerk API). */
export function isClerkJwtTemplateMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const name = (error as { name?: string }).name
  const status = (error as { status?: number }).status
  const message = error instanceof Error ? error.message : String(error)
  return name === "ClerkAPIResponseError" && (status === 404 || message.toLowerCase().includes("not found"))
}

/** True when preload failed because the Convex user row is not provisioned yet. */
export function isUserNotProvisionedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const data = (error as { data?: { code?: string } }).data
  if (data?.code === "USER_NOT_PROVISIONED") return true
  const message = error instanceof Error ? error.message : String(error)
  return message.includes("USER_NOT_PROVISIONED") || message.includes("still being set up")
}

/** Preload errors that should fall back to client queries without logging as failures. */
export function isPreloadSkippableError(error: unknown): boolean {
  return error instanceof ClerkConvexTokenUnavailableError || isUserNotProvisionedError(error)
}

/** Deduped per-request Clerk JWT for Convex preloads. */
const getConvexAuthToken = cache(async (): Promise<string | undefined> => {
  try {
    const { getToken, userId } = await auth()
    if (!userId) return undefined
    return (await getToken({ template: CLERK_CONVEX_JWT_TEMPLATE })) ?? undefined
  } catch (error) {
    if (isClerkJwtTemplateMissingError(error)) {
      console.warn(
        `[convex-server] Clerk JWT template '${CLERK_CONVEX_JWT_TEMPLATE}' not found. ` +
          "Enable Convex integration at https://dashboard.clerk.com/apps/setup/convex"
      )
      return undefined
    }
    throw error
  }
})

/** Preload a Convex query on the server with the signed-in user's Clerk JWT. */
async function preloadConvexQuery<Query extends FunctionReference<"query">>(query: Query, args: Query["_args"]) {
  const token = await getConvexAuthToken()
  if (!token) {
    throw new ClerkConvexTokenUnavailableError()
  }
  return preloadQuery(query, args, { ...convexOptions, token })
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

/** Deduped per-request preload for the signed-in user's Convex row. */
export const preloadCurrentUser = cache(async () => {
  return preloadConvexQuery(api.users.queries.currentUser, {})
})

export type SurveyCommandCenterPreloadFilters = {
  districtId?: Id<"districts">
  municipalityId?: Id<"municipalities">
  wardNo?: string
  status?: "draft" | "submitted" | "approved" | "rejected"
  qcStatus?: "pending" | "approved" | "rejected"
  fromMs?: number
  toMs?: number
}

/** Preload survey detail for server-rendered detail pages. */
export const preloadSurveyDetail = cache(async (id: Id<"surveys">) => {
  return preloadConvexQuery(api.surveys.queries.get, { id })
})

/** Preload command center KPI + ward stats. */
export const preloadSurveyCommandCenter = cache(
  async (nowMs: number, filters: SurveyCommandCenterPreloadFilters = {}) => {
    return preloadConvexQuery(api.surveys.queries.commandCenterStats, { nowMs, ...filters })
  }
)

export type QcCommandCenterPreloadFilters = {
  districtId?: Id<"districts">
  municipalityId?: Id<"municipalities">
  wardNo?: string
  fromMs?: number
  toMs?: number
}

/** Preload QC command center KPI + ward stats (default filters supported). */
export const preloadQcCommandCenterStats = cache(async (nowMs: number, filters: QcCommandCenterPreloadFilters = {}) => {
  return preloadConvexQuery(api.qc.queries.commandCenterStats, { nowMs, ...filters })
})

/** Preload first page of registry list (default scope). */
export const preloadSurveyRegistryPage = cache(async (nowMs: number, pageSize = 20) => {
  return preloadConvexQuery(api.surveys.queries.listPaginated, {
    paginationOpts: { numItems: pageSize, cursor: null },
    nowMs,
  })
})

/** Preload users directory first page for admin Users route. */
export const preloadAdminUsersPage = cache(async (pageSize = 15) => {
  return preloadConvexQuery(api.admin.queries.listUsers, {
    paginationOpts: { numItems: pageSize, cursor: null },
  })
})

/** Preload pending approvals for Users route KPIs. */
export const preloadAdminPendingApprovals = cache(async () => {
  return preloadConvexQuery(api.admin.queries.listPendingApprovals, {})
})

/** Preload assignable roles for Users filters and forms. */
export const preloadAdminAssignableRoles = cache(async () => {
  return preloadConvexQuery(api.rbac.queries.listAssignableRoles, { includeInactive: false })
})

/** Preload active user count for directory KPIs. */
export const preloadAdminActiveUserCount = cache(async () => {
  return preloadConvexQuery(api.admin.queries.countActiveUsers, {})
})

/** Preload disabled user count for directory KPIs. */
export const preloadAdminDisabledUserCount = cache(async () => {
  return preloadConvexQuery(api.admin.queries.countDisabledUsers, {})
})

/** Preload roles + permissions for Roles admin route. */
export const preloadAdminRolesPage = cache(async () => {
  const [preloadedRoles, preloadedPermissions] = await Promise.all([
    preloadConvexQuery(api.rbac.queries.listRoles, { includeInactive: true }),
    preloadConvexQuery(api.rbac.queries.listPermissions, {}),
  ])
  return { preloadedRoles, preloadedPermissions }
})

/** Preload tenant tree for Masters admin route. */
export const preloadAdminTenants = cache(async () => {
  return preloadConvexQuery(api.tenants.queries.listForAdmin, {})
})

/** Preload audit feed first page + summary + facets. */
export const preloadAdminAuditPage = cache(async (nowMs: number, pageSize = 15) => {
  const [preloadedRows, preloadedSummary, preloadedFacets] = await Promise.all([
    preloadConvexQuery(api.audit.queries.listPaginated, {
      paginationOpts: { numItems: pageSize, cursor: null },
    }),
    preloadConvexQuery(api.audit.queries.summary, { nowMs }),
    preloadConvexQuery(api.audit.queries.actionFacets, {}),
  ])
  return { preloadedRows, preloadedSummary, preloadedFacets }
})
