import { query } from "../_generated/server"
import { permissionsForRole } from "../shared/capabilities"

/** Current signed-in user's domain row, or null until provisioned. */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const ident = await ctx.auth.getUserIdentity()
    if (!ident) return null

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", ident.subject))
      .unique()

    if (!user) return null

    // Single role load serves both capabilities and display name (was duplicate indexed lookup).
    const roleRow = await ctx.db
      .query("roles")
      .withIndex("by_key", (q) => q.eq("key", user.role))
      .unique()

    let municipality: { code: string; name: string } | null = null
    let district: { code: string; name: string } | null = null

    if (user.districtId) {
      const dist = await ctx.db.get("districts", user.districtId)
      if (dist) district = { code: dist.code, name: dist.name }
    }
    if (user.municipalityId) {
      const muni = await ctx.db.get("municipalities", user.municipalityId)
      if (muni) {
        municipality = { code: muni.code, name: muni.name }
        if (!district) {
          const dist = await ctx.db.get("districts", muni.districtId)
          if (dist) district = { code: dist.code, name: dist.name }
        }
      }
    }

    // Reuse roleRow when present; permissionsForRole only hits DB again if role missing/inactive.
    const capabilities =
      roleRow && roleRow.isActive !== false
        ? (
            await ctx.db
              .query("rolePermissions")
              .withIndex("by_role", (q) => q.eq("roleId", roleRow._id))
              .collect()
          )
            .map((r) => r.permissionKey)
            .sort()
        : Array.from(await permissionsForRole(ctx, user.role)).sort()

    return {
      ...user,
      municipality,
      district,
      capabilities,
      roleName: roleRow?.name ?? user.role,
    }
  },
})
