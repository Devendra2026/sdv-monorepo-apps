/**
 * Tenant hierarchy — districts → ULBs (municipalities) → wards.
 *
 * Multitenant isolation:
 *   - admin: all active districts / ULBs
 *   - districtId on user: all ULBs in that district
 *   - municipalityId on user: single ULB (+ its district for display)
 *   - surveyor ward checks remain in helpers.assertCanReadWard
 */
import { query } from "../_generated/server"
import { requireCapability } from "../shared/capabilities"
import { requireUser } from "../shared/helpers"

/** Admin inbox — full tenant tree for setup screens. */
export const listForAdmin = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx)
    await requireCapability(ctx, me, "tenants.manage")

    const [districts, municipalities, wards] = await Promise.all([
      ctx.db.query("districts").collect(),
      ctx.db.query("municipalities").collect(),
      ctx.db.query("wards").collect(),
    ])

    return districts
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((d) => ({
        ...d,
        ulbs: municipalities
          .filter((m) => m.districtId === d._id)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((m) => ({
            ...m,
            wards: wards
              .filter((w) => w.municipalityId === m._id)
              .sort((a, b) => a.wardNo.localeCompare(b.wardNo, undefined, { numeric: true })),
          })),
      }))
  },
})

/** Assessment years for admin tenant setup (global masters, category assessment_year). */
export const listAssessmentYears = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx)
    await requireCapability(ctx, me, "tenants.manage")

    const rows = await ctx.db
      .query("masters")
      .withIndex("by_category_position", (q) => q.eq("category", "assessment_year").eq("isActive", true))
      .collect()

    return rows
      .sort((a, b) => a.position - b.position)
      .map((m) => ({ _id: m._id, value: m.value, label: m.label, position: m.position, isActive: m.isActive }))
  },
})
