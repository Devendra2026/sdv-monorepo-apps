import { query } from "../_generated/server"
import { userCapabilities } from "../shared/capabilities"

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

    let municipality: { code: string; name: string } | null = null
    let district: { code: string; name: string } | null = null

    if (user.districtId) {
      const dist = await ctx.db.get(user.districtId)
      if (dist) district = { code: dist.code, name: dist.name }
    }
    if (user.municipalityId) {
      const muni = await ctx.db.get(user.municipalityId)
      if (muni) {
        municipality = { code: muni.code, name: muni.name }
        if (!district) {
          const dist = await ctx.db.get(muni.districtId)
          if (dist) district = { code: dist.code, name: dist.name }
        }
      }
    }

    const [capabilities, roleRow] = await Promise.all([
      userCapabilities(ctx, user),
      ctx.db
        .query("roles")
        .withIndex("by_key", (q) => q.eq("key", user.role))
        .unique(),
    ])

    return {
      ...user,
      municipality,
      district,
      capabilities,
      roleName: roleRow?.name ?? user.role,
    }
  },
})
