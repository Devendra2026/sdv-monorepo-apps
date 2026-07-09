/**
 * Admin-only operations — queries.
 *
 * Every function in this module calls `requireRole(me, "admin")` or capability checks
 * so the mobile app can call these directly without an additional auth check.
 */
import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"
import { query } from "../_generated/server"
import { userRole } from "../schema"
import { requireCapability } from "../shared/capabilities"
import { assertUserVisibleToCaller, filterUsersToCallerScope, requireUser } from "../shared/helpers"
import { resolveTenantScope, tenantDistrictIds, tenantMunicipalityIds } from "../shared/tenancy"
import { assertCanListUsers, hydrateUsersForAdmin } from "./helpers"

/**
 * Returns every user awaiting approval, newest first. Drives the admin
 * "Pending approvals" inbox.
 */
export const listPendingApprovals = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx)
    await requireCapability(ctx, me, "users.approve")

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
export const pendingApprovalCount = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx)
    await requireCapability(ctx, me, "users.approve")

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

    let q
    if (args.role && args.status) {
      q = ctx.db
        .query("users")
        .withIndex("by_role_status", (qb) => qb.eq("role", args.role!).eq("status", args.status!))
    } else if (args.status) {
      q = ctx.db.query("users").withIndex("by_status", (qb) => qb.eq("status", args.status!))
    } else if (args.role) {
      q = ctx.db.query("users").withIndex("by_role_status", (qb) => qb.eq("role", args.role!))
    } else {
      q = ctx.db.query("users")
    }

    const page = await q.order("desc").paginate(args.paginationOpts)
    const scoped = await filterUsersToCallerScope(ctx, me, page.page)
    return {
      ...page,
      page: await hydrateUsersForAdmin(ctx, scoped),
    }
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
        .withIndex("by_municipality", (q) => q.eq("municipalityId", municipalityId))
        .collect()
      for (const row of rows) {
        if (row.status === "active") seen.add(row._id)
      }
    }
    for (const districtId of districtIds) {
      const rows = await ctx.db
        .query("users")
        .withIndex("by_district", (q) => q.eq("districtId", districtId))
        .collect()
      for (const row of rows) {
        if (row.status === "active") seen.add(row._id)
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
