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

/** Admin overview — all municipalities with their rate status. */
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

    const [municipalities, rates] = await Promise.all([
      ctx.db.query("municipalities").collect(),
      ctx.db.query("taxRates").collect(),
    ])

    const ratesByMuni = new Map(rates.map((r) => [r.municipalityId, r]))

    return municipalities.map((m) => {
      const row = ratesByMuni.get(m._id)
      return {
        municipality: m,
        rates: row ? normalizeStoredTaxRates(row) : null,
      }
    })
  },
})
