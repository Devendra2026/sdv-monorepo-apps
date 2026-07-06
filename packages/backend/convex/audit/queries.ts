import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"
import { query } from "../_generated/server"
import { requireRole, requireUser } from "../shared/helpers"
import { auditQuery, hydrateAuditRows } from "./helpers"

/**
 * Paginated, filterable audit feed. Admin-only — matches the role matrix
 * (only ADMIN has "View audit logs").
 */
export const list = query({
  args: {
    entity: v.optional(v.string()),
    entityId: v.optional(v.string()),
    actorId: v.optional(v.id("users")),
    action: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    requireRole(me, "admin")

    const limit = Math.min(args.limit ?? 100, 500)

    let rows = await auditQuery(ctx, args)
      .order("desc")
      .take(limit * 2)

    if (args.action) {
      rows = rows.filter((r) => r.action === args.action)
    }
    rows = rows.slice(0, limit)

    return hydrateAuditRows(ctx, rows)
  },
})

/** Cursor-paginated audit feed — fetches one page at a time for fast UI render. */
export const listPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    entity: v.optional(v.string()),
    entityId: v.optional(v.string()),
    actorId: v.optional(v.id("users")),
    action: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    requireRole(me, "admin")

    const page = await auditQuery(ctx, args).order("desc").paginate(args.paginationOpts)
    let rows = page.page
    if (args.action) {
      rows = rows.filter((r) => r.action === args.action)
    }

    return {
      ...page,
      page: await hydrateAuditRows(ctx, rows),
    }
  },
})

/** Lightweight KPI stats — scans a recent window instead of hydrating the full feed. */
export const summary = query({
  args: { nowMs: v.number() },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    requireRole(me, "admin")

    const recent = await ctx.db.query("auditLogs").withIndex("by_creation_time").order("desc").take(1000)
    const dayMs = 86_400_000

    return {
      total: recent.length,
      capped: recent.length === 1000,
      actions: new Set(recent.map((r) => r.action)).size,
      entities: new Set(recent.map((r) => r.entity)).size,
      today: recent.filter((r) => args.nowMs - r._creationTime < dayMs).length,
    }
  },
})

/** Distinct action + entity values — drives both filter dropdowns in one round trip. */
export const actionFacets = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx)
    requireRole(me, "admin")
    const rows = await ctx.db.query("auditLogs").withIndex("by_creation_time").order("desc").take(1000)
    return {
      actions: Array.from(new Set(rows.map((r) => r.action))).sort(),
      entities: Array.from(new Set(rows.map((r) => r.entity))).sort(),
    }
  },
})
