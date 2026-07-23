/**
 * Dynamic tax rate configuration per municipality (ULB).
 *
 * Demand notice rate model:
 *   Gross ALV = area × panel rate × 12 × usageMult (commercial ×2, residential ×1)
 *   Assessable ALV = gross ALV × 80%
 *   Property tax = assessable ALV × propertyTaxPct (e.g. 10%)
 *   Water / drainage = total assessable ALV × respective %
 *   Total demand (yearly) = property tax + water + drainage
 */
import { v } from "convex/values"
import { query } from "../_generated/server"
import { mapPool } from "../lib/mapPool"
import { normalizeStoredTaxRates } from "../lib/qc/normalizeTaxRates"
import { requireCapability } from "../shared/capabilities"
import { requireUser } from "../shared/helpers"
import { assertMunicipalityInScope } from "../shared/tenancy"
import { normalizedTaxRatesValidator } from "./helpers"

/** Returns the rate config for a ULB, or null (caller should use defaults). */
export const getForMunicipality = query({
  args: { municipalityId: v.id("municipalities") },
  returns: v.union(normalizedTaxRatesValidator, v.null()),
  handler: async (ctx, { municipalityId }) => {
    const me = await requireUser(ctx)
    await assertMunicipalityInScope(ctx, me, municipalityId)

    const doc = await ctx.db
      .query("taxRates")
      .withIndex("by_municipality", (q) => q.eq("municipalityId", municipalityId))
      .unique()

    if (!doc) return null
    return normalizeStoredTaxRates(doc)
  },
})

const RATE_LOOKUP_CONCURRENCY = 10

/** Admin overview — municipalities with rate status (indexed district fan-out, no full-table collect). */
export const listAll = query({
  args: {},
  returns: v.array(
    v.object({
      municipality: v.object({
        _id: v.id("municipalities"),
        _creationTime: v.number(),
        name: v.string(),
        code: v.string(),
        bodyType: v.union(v.literal("municipal_council"), v.literal("town_panchayat")),
        districtId: v.id("districts"),
        postalCode: v.optional(v.string()),
        isActive: v.boolean(),
      }),
      rates: v.union(normalizedTaxRatesValidator, v.null()),
    })
  ),
  handler: async (ctx) => {
    const me = await requireUser(ctx)
    await requireCapability(ctx, me, "masters.manage")

    const [activeDistricts, inactiveDistricts] = await Promise.all([
      ctx.db
        .query("districts")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect(),
      ctx.db
        .query("districts")
        .withIndex("by_active", (q) => q.eq("isActive", false))
        .collect(),
    ])
    const districts = [...activeDistricts, ...inactiveDistricts]

    const municipalities = []
    for (const d of districts) {
      const ulbs = await ctx.db
        .query("municipalities")
        .withIndex("by_district", (q) => q.eq("districtId", d._id))
        .collect()
      municipalities.push(...ulbs)
    }

    const rateDocs = await mapPool(municipalities, RATE_LOOKUP_CONCURRENCY, (m) =>
      ctx.db
        .query("taxRates")
        .withIndex("by_municipality", (q) => q.eq("municipalityId", m._id))
        .unique()
    )

    return municipalities.map((m, index) => {
      const row = rateDocs[index]
      return {
        municipality: m,
        rates: row ? normalizeStoredTaxRates(row) : null,
      }
    })
  },
})
