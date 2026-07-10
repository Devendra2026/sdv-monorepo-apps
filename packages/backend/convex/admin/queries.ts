/**
 * Admin-only operations — queries.
 *
 * Every function in this module calls `requireRole(me, "admin")` or capability checks
 * so the mobile app can call these directly without an additional auth check.
 */
import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"
import type { Doc } from "../_generated/dataModel"
import { query } from "../_generated/server"
import { capabilityQuery } from "../lib/customFunctions"
import { userRole } from "../schema"
import { assertUserVisibleToCaller, filterUsersToCallerScope, requireUser } from "../shared/helpers"
import { resolveTenantScope, tenantDistrictIds, tenantMunicipalityIds } from "../shared/tenancy"
import { assertCanListUsers, hydrateUsersForAdmin } from "./helpers"

const usersApproveQuery = capabilityQuery("users.approve")

async function paginateUsersForCaller(
  ctx: Parameters<typeof filterUsersToCallerScope>[0],
  me: Doc<"users">,
  args: {
    paginationOpts: { numItems: number; cursor: string | null }
    role?: string
    status?: "pending_approval" | "active" | "disabled"
  }
) {
  let q
  if (args.role && args.status) {
    q = ctx.db.query("users").withIndex("by_role_status", (qb) => qb.eq("role", args.role!).eq("status", args.status!))
  } else if (args.status) {
    q = ctx.db.query("users").withIndex("by_status", (qb) => qb.eq("status", args.status!))
  } else if (args.role) {
    q = ctx.db.query("users").withIndex("by_role_status", (qb) => qb.eq("role", args.role!))
  } else {
    q = ctx.db.query("users")
  }

  if (me.role === "admin") {
    const page = await q.order("desc").paginate(args.paginationOpts)
    return {
      ...page,
      page: await hydrateUsersForAdmin(ctx, page.page),
    }
  }

  const targetSize = args.paginationOpts.numItems
  let cursor = args.paginationOpts.cursor
  const scoped: Doc<"users">[] = []
  let isDone = false
  let continueCursor: string | null = null

  while (scoped.length < targetSize && !isDone) {
    const batchSize = Math.max(targetSize * 2, 20)
    const page = await q.order("desc").paginate({ numItems: batchSize, cursor })
    const visible = await filterUsersToCallerScope(ctx, me, page.page)
    scoped.push(...visible)
    isDone = page.isDone
    continueCursor = page.continueCursor
    cursor = page.continueCursor
    if (page.isDone || page.continueCursor === null) break
  }

  return {
    page: await hydrateUsersForAdmin(ctx, scoped.slice(0, targetSize)),
    isDone: isDone && scoped.length <= targetSize,
    continueCursor,
  }
}

/**
 * Returns every user awaiting approval, newest first. Drives the admin
 * "Pending approvals" inbox.
 */
export const listPendingApprovals = usersApproveQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("users")
      .withIndex("by_status", (q) => q.eq("status", "pending_approval"))
      .order("desc")
      .collect()

    return rows.map((u) => ({
      _id: u._id,
      email: u.email,
      name: u.name,
      avatarUrl: u.avatarUrl,
      requestedRole: u.requestedRole,
      requestedReason: u.requestedReason,
      createdAt: u._creationTime,
    }))
  },
})

/** Pending approval count for admin mobile badge / dashboard KPIs. */
export const pendingApprovalCount = usersApproveQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("users")
      .withIndex("by_status", (q) => q.eq("status", "pending_approval"))
      .collect()
    return rows.length
  },
})

export const listUsers = query({
  args: {
    paginationOpts: paginationOptsValidator,
    role: v.optional(userRole),
    status: v.optional(v.union(v.literal("pending_approval"), v.literal("active"), v.literal("disabled"))),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    await assertCanListUsers(ctx, me)
    return paginateUsersForCaller(ctx, me, args)
  },
})

/** Active user count for admin dashboard cards. */
export const countActiveUsers = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx)
    await assertCanListUsers(ctx, me)

    if (me.role === "admin") {
      const rows = await ctx.db
        .query("users")
        .withIndex("by_status", (q) => q.eq("status", "active"))
        .collect()
      return rows.length
    }

    const scope = await resolveTenantScope(ctx, me)
    const muniIds = [...tenantMunicipalityIds(scope)]
    const districtIds = [...tenantDistrictIds(scope)]
    const seen = new Set<string>()

    for (const municipalityId of muniIds) {
      const rows = await ctx.db
        .query("users")
        .withIndex("by_municipality_status", (q) => q.eq("municipalityId", municipalityId).eq("status", "active"))
        .collect()
      for (const row of rows) {
        seen.add(row._id)
      }
    }
    for (const districtId of districtIds) {
      const rows = await ctx.db
        .query("users")
        .withIndex("by_district_status", (q) => q.eq("districtId", districtId).eq("status", "active"))
        .collect()
      for (const row of rows) {
        seen.add(row._id)
      }
    }
    return seen.size
  },
})

/** Disabled user count for admin directory KPIs. */
export const countDisabledUsers = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx)
    await assertCanListUsers(ctx, me)

    if (me.role === "admin") {
      const rows = await ctx.db
        .query("users")
        .withIndex("by_status", (q) => q.eq("status", "disabled"))
        .collect()
      return rows.length
    }

    const scope = await resolveTenantScope(ctx, me)
    const muniIds = [...tenantMunicipalityIds(scope)]
    const districtIds = [...tenantDistrictIds(scope)]
    const seen = new Set<string>()

    for (const municipalityId of muniIds) {
      const rows = await ctx.db
        .query("users")
        .withIndex("by_municipality_status", (q) => q.eq("municipalityId", municipalityId).eq("status", "disabled"))
        .collect()
      for (const row of rows) {
        seen.add(row._id)
      }
    }
    for (const districtId of districtIds) {
      const rows = await ctx.db
        .query("users")
        .withIndex("by_district_status", (q) => q.eq("districtId", districtId).eq("status", "disabled"))
        .collect()
      for (const row of rows) {
        seen.add(row._id)
      }
    }
    return seen.size
  },
})

/** Single user row for admin assignment / detail screens. */
export const getUserForAdmin = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const [me, row] = await Promise.all([requireUser(ctx), ctx.db.get(args.userId)])
    await assertCanListUsers(ctx, me)
    if (!row) return null
    await assertUserVisibleToCaller(ctx, me, row)

    const [user] = await hydrateUsersForAdmin(ctx, [row])
    return user ?? null
  },
})
