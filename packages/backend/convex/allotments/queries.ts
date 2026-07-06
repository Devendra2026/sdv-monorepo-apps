import { v } from "convex/values"
import type { Id } from "../_generated/dataModel"
import { query } from "../_generated/server"
import { assertUserVisibleToCaller, requireRole, requireUser } from "../shared/helpers"

export const listForUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    requireRole(me, "admin", "supervisor")

    const target = await ctx.db.get(args.userId)
    if (!target) return []
    await assertUserVisibleToCaller(ctx, me, target)

    const rows = await ctx.db
      .query("userAllotments")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect()

    const districtIds = new Set<Id<"districts">>()
    const municipalityIds = new Set<Id<"municipalities">>()
    for (const a of rows) {
      if (a.districtId) districtIds.add(a.districtId)
      if (a.municipalityId) municipalityIds.add(a.municipalityId)
    }

    const [districtDocs, municipalityDocs] = await Promise.all([
      Promise.all([...districtIds].map((id) => ctx.db.get(id))),
      Promise.all([...municipalityIds].map((id) => ctx.db.get(id))),
    ])
    const districtById = new Map<Id<"districts">, string>()
    for (const d of districtDocs) {
      if (d) districtById.set(d._id, d.name)
    }
    const municipalityById = new Map<Id<"municipalities">, NonNullable<(typeof municipalityDocs)[number]>>()
    for (const m of municipalityDocs) {
      if (m) municipalityById.set(m._id, m)
    }

    const missingDistrictIds = new Set<Id<"districts">>()
    for (const m of municipalityDocs) {
      if (m && !districtById.has(m.districtId)) missingDistrictIds.add(m.districtId)
    }
    if (missingDistrictIds.size > 0) {
      const extraDistrictDocs = await Promise.all([...missingDistrictIds].map((id) => ctx.db.get(id)))
      for (const d of extraDistrictDocs) {
        if (d) districtById.set(d._id, d.name)
      }
    }

    const result = rows.map((a) => {
      let districtName: string | null = a.districtId ? (districtById.get(a.districtId) ?? null) : null
      const m = a.municipalityId ? municipalityById.get(a.municipalityId) : undefined
      const municipalityName = m?.name ?? null
      if (!districtName && m) {
        districtName = districtById.get(m.districtId) ?? null
      }
      return { ...a, districtName, municipalityName }
    })
    return result.sort((a, b) => Number(b.isActive) - Number(a.isActive) || b.assignedAt - a.assignedAt)
  },
})
