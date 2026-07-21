/**
 * Tenant hierarchy — districts → ULBs (municipalities) → wards.
 *
 * Multitenant isolation:
 *   - admin: all active districts / ULBs
 *   - districtId on user: all ULBs in that district
 *   - municipalityId on user: single ULB (+ its district for display)
 *   - surveyor ward checks remain in helpers.assertCanReadWard
 *
 * listForAdmin loads sequentially (no nested Promise.all fan-out) so a slow
 * or failing read stays on the main UDF promise chain — avoids self-hosted
 * UnhandledPromiseRejection → "Restarting Isolate" under export load.
 */
import { capabilityQuery } from "../lib/customFunctions"
import { buildAdminTenantTree, type AdminUlbInput, type AdminWardInput } from "./adminTree"

const tenantsManageQuery = capabilityQuery("tenants.manage")

/** Admin inbox — full tenant tree for setup screens. */
export const listForAdmin = tenantsManageQuery({
  args: {},
  handler: async (ctx) => {
    const districts = await ctx.db
      .query("districts")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect()

    const municipalities: AdminUlbInput[] = []
    for (const d of districts) {
      const ulbs = await ctx.db
        .query("municipalities")
        .withIndex("by_district_active", (q) => q.eq("districtId", d._id).eq("isActive", true))
        .collect()
      for (const m of ulbs) {
        const row: AdminUlbInput = {
          _id: m._id,
          districtId: m.districtId,
          code: m.code,
          name: m.name,
          bodyType: m.bodyType,
          isActive: m.isActive,
        }
        if (m.postalCode !== undefined) row.postalCode = m.postalCode
        municipalities.push(row)
      }
    }

    const wards: AdminWardInput[] = []
    for (const m of municipalities) {
      const wardRows = await ctx.db
        .query("wards")
        .withIndex("by_municipality", (q) => q.eq("municipalityId", m._id))
        .collect()
      for (const w of wardRows) {
        wards.push({
          _id: w._id,
          municipalityId: w.municipalityId,
          wardNo: w.wardNo,
          wardCode: w.wardCode,
          name: w.name,
        })
      }
    }

    return buildAdminTenantTree(
      districts.map((d) => ({
        _id: d._id,
        code: d.code,
        name: d.name,
        stateName: d.stateName,
        isActive: d.isActive,
      })),
      municipalities,
      wards
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
