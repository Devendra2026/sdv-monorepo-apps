import { v } from "convex/values"
import { query } from "../_generated/server"
import { hasCapability, userCapabilities } from "../shared/capabilities"
import { clientError, requireRole, requireUser } from "../shared/helpers"
import { listRolesWithPermissions } from "./helpers"

export const listPermissions = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    requireRole(me, "admin")

    const rows = await ctx.db.query("permissions").collect()
    return rows
      .filter((p) => args.includeInactive || p.isActive)
      .sort((a, b) => a.category.localeCompare(b.category) || a.key.localeCompare(b.key))
  },
})

export const listRoles = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    requireRole(me, "admin")
    return await listRolesWithPermissions(ctx, args.includeInactive)
  },
})

/** Roles visible on the Users page (system + custom) for filters and assignment. */
export const listAssignableRoles = query({
  args: { includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const canList = (await hasCapability(ctx, me, "users.view")) || (await hasCapability(ctx, me, "users.approve"))
    if (!canList) {
      clientError("FORBIDDEN", "You don't have permission to view roles")
    }
    return await listRolesWithPermissions(ctx, args.includeInactive)
  },
})

export const myCapabilities = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx, { allowPending: true })
    return await userCapabilities(ctx, me)
  },
})
