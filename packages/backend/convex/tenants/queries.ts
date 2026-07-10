/**
 * Tenant hierarchy — districts → ULBs (municipalities) → wards.
 *
 * Multitenant isolation:
 *   - admin: all active districts / ULBs
 *   - districtId on user: all ULBs in that district
 *   - municipalityId on user: single ULB (+ its district for display)
 *   - surveyor ward checks remain in helpers.assertCanReadWard
 */
import { capabilityQuery } from "../lib/customFunctions"

const tenantsManageQuery = capabilityQuery("tenants.manage")

/** Admin inbox — full tenant tree for setup screens. */
export const listForAdmin = tenantsManageQuery({
  args: {},
  handler: async (ctx) => {
    const districts = await ctx.db
      .query("districts")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect()

    const sortedDistricts = districts.sort((a, b) => a.name.localeCompare(b.name))

    return Promise.all(
      sortedDistricts.map(async (d) => {
        const ulbs = (
          await ctx.db
            .query("municipalities")
            .withIndex("by_district_active", (q) => q.eq("districtId", d._id).eq("isActive", true))
            .collect()
        ).sort((a, b) => a.name.localeCompare(b.name))

        const ulbsWithWards = await Promise.all(
          ulbs.map(async (m) => ({
            ...m,
            wards: (
              await ctx.db
                .query("wards")
                .withIndex("by_municipality", (q) => q.eq("municipalityId", m._id))
                .collect()
            ).sort((a, b) => a.wardNo.localeCompare(b.wardNo, undefined, { numeric: true })),
          }))
        )

        return { ...d, ulbs: ulbsWithWards }
      })
    )
  },
})

/** Assessment years for admin tenant setup (global masters, category assessment_year). */
export const listAssessmentYears = tenantsManageQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("masters")
      .withIndex("by_category_position", (q) => q.eq("category", "assessment_year").eq("isActive", true))
      .collect()

    return rows
      .sort((a, b) => a.position - b.position)
      .map((m) => ({ _id: m._id, value: m.value, label: m.label, position: m.position, isActive: m.isActive }))
  },
})
