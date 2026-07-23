/**
 * Tenant hierarchy — districts → ULBs (municipalities) → wards.
 *
 * Multitenant isolation:
 *   - admin: all active districts / ULBs
 *   - districtId on user: all ULBs in that district
 *   - municipalityId on user: single ULB (+ its district for display)
 *   - surveyor ward checks remain in helpers.assertCanReadWard
 *
 * listForAdmin loads districts + ULBs only. Wards load on demand via
 * wardsForMunicipality to avoid materializing the full ward tree in one query.
 */
import { v } from "convex/values"
import { capabilityQuery } from "../lib/customFunctions"
import { buildAdminTenantTree, compareWardNo, type AdminUlbInput } from "./adminTree"

const tenantsManageQuery = capabilityQuery("tenants.manage")

/** Admin inbox — district/ULB tree (wards loaded lazily per ULB). */
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

    return buildAdminTenantTree(
      districts.map((d) => ({
        _id: d._id,
        code: d.code,
        name: d.name,
        stateName: d.stateName,
        isActive: d.isActive,
      })),
      municipalities,
      [] // wards loaded via wardsForMunicipality
    )
  },
})

/** Lazy ward list for one ULB (admin tenant setup / assignment forms). */
export const wardsForMunicipality = tenantsManageQuery({
  args: { municipalityId: v.id("municipalities") },
  handler: async (ctx, args) => {
    const muni = await ctx.db.get(args.municipalityId)
    if (!muni) return []

    const rows = await ctx.db
      .query("wards")
      .withIndex("by_municipality", (q) => q.eq("municipalityId", args.municipalityId))
      .collect()

    return rows
      .slice()
      .sort((a, b) => compareWardNo(a.wardNo, b.wardNo))
      .map((w) => ({
        _id: w._id,
        municipalityId: w.municipalityId,
        wardNo: w.wardNo,
        wardCode: w.wardCode,
        name: w.name,
      }))
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
