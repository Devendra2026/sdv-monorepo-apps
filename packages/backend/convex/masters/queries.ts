/**
 * Master data + bundles. The mobile app calls `bundle` once on app start
 * (and then relies on Convex's reactive cache to push updates).
 */
import { v } from "convex/values"
import type { Id } from "../_generated/dataModel"
import { query } from "../_generated/server"
import { capabilityQuery } from "../lib/customFunctions"
import { CONSTRUCTION_TYPES, FLOOR_NAMES, FLOOR_USAGE_FACTORS, FLOOR_USAGE_TYPES } from "../lib/masters/areaMasters"
import { RESPONDENT_RELATIONSHIPS } from "../lib/masters/ownerConstants"
import { mergeMasterOptions, SANITATION_TYPES, WATER_SOURCES } from "../lib/masters/serviceMasters"
import {
  defaultMasterRowsForCategory,
  OWNERSHIP_TYPES,
  PROPERTY_USE_SUBCATEGORIES,
  PROPERTY_USES,
  PROPERTY_USES_REQUIRING_SUBCATEGORY,
  resolveMasterCategory,
  ROAD_TYPES,
  SITUATIONS,
  TAX_RATE_ZONES,
} from "../lib/masters/taxationMasters"
import { loadDashboardCountsForHome } from "../lib/surveyScopeStats"
import { startOfDayMs } from "../shared/calendar"
import { filterWardsForUser, requireIdentity, requireUser } from "../shared/helpers"
import { assertMunicipalityInScope, resolveTenantScope } from "../shared/tenancy"
import {
  addressTenantContext,
  loadActiveMastersByCategory,
  loadWardsForMunicipalities,
  MAX_SURVEY_OWNERS,
} from "./helpers"

const mastersManageQuery = capabilityQuery("masters.manage")

/**
 * Returns every active dropdown grouped by category, plus the full set of
 * municipalities and wards the caller has any read access to. The mobile
 * uses this as the single source of truth for every dropdown menu.
 */
export const bundle = query({
  args: {
    /** Web clients should pass false and load wards via `wardsForMunicipality` on demand. */
    includeWards: v.optional(v.boolean()),
    /** Pass false when only dropdown masters are needed (e.g. floors editor) — skips tenant scope reads. */
    includeTenantCatalog: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const includeWards = args.includeWards ?? true
    const includeTenantCatalog = args.includeTenantCatalog ?? true

    const grouped = await loadActiveMastersByCategory(ctx)

    let districtsOut: Array<{ _id: Id<"districts">; code: string; name: string; stateName: string }> = []
    let ulbs: Array<{
      _id: Id<"municipalities">
      code: string
      name: string
      bodyType: string
      districtId: Id<"districts">
      districtName: string
      districtCode: string
      stateName: string
      postalCode: string | null
    }> = []
    let wardOut: Awaited<ReturnType<typeof loadWardsForMunicipalities>> = []

    if (includeTenantCatalog) {
      const { districts: visibleDistricts, municipalities: visibleMunis } = await resolveTenantScope(ctx, me)
      const districtsById = new Map(visibleDistricts.map((d) => [d._id, d]))

      districtsOut = visibleDistricts.map((d) => ({
        _id: d._id,
        code: d.code,
        name: d.name,
        stateName: d.stateName,
      }))

      ulbs = visibleMunis.map((m) => {
        const d = districtsById.get(m.districtId)
        return {
          _id: m._id,
          code: m.code,
          name: m.name,
          bodyType: m.bodyType,
          districtId: m.districtId,
          districtName: d?.name ?? "",
          districtCode: d?.code ?? "",
          stateName: d?.stateName ?? "",
          postalCode: m.postalCode ?? null,
        }
      })

      wardOut = includeWards ? filterWardsForUser(me, await loadWardsForMunicipalities(ctx, visibleMunis)) : []
    }

    return {
      districts: districtsOut,
      ulbs,
      wards: wardOut,
      tenantScope: includeTenantCatalog
        ? {
            districtCount: districtsOut.length,
            municipalityCount: ulbs.length,
            wardCount: wardOut.length,
            primaryMunicipalityId: me.municipalityId ?? null,
            wardAssignments: me.wardAssignments,
          }
        : null,
      // Each category is optional in case it isn't seeded yet on a fresh deployment.
      assessmentYears: grouped["assessment_year"] ?? [],
      ownershipTypes: grouped["ownership_type"]?.length ? grouped["ownership_type"]! : OWNERSHIP_TYPES,
      propertyUses: (grouped["property_use"]?.length ? grouped["property_use"]! : PROPERTY_USES).filter(
        (o) => o.value !== "agricultural_land"
      ),
      propertyUseSubcategories: PROPERTY_USE_SUBCATEGORIES,
      propertyUsesRequiringSubcategory: PROPERTY_USES_REQUIRING_SUBCATEGORY,
      situations: grouped["situation"]?.length ? grouped["situation"]! : SITUATIONS,
      roadTypes: grouped["road_type"]?.length ? grouped["road_type"]! : ROAD_TYPES,
      taxRateZones: grouped["tax_rate_zone"]?.length ? grouped["tax_rate_zone"]! : TAX_RATE_ZONES,
      relationships: RESPONDENT_RELATIONSHIPS,
      waterSources: mergeMasterOptions(WATER_SOURCES, grouped["water_source"]),
      sanitationTypes: mergeMasterOptions(SANITATION_TYPES, grouped["sanitation_type"]),
      usageFactors: grouped["usage_factor"]?.length
        ? grouped["usage_factor"]!
        : grouped["usage_type"]?.length
          ? grouped["usage_type"]!
          : FLOOR_USAGE_FACTORS,
      usageTypes: grouped["floor_usage_type"]?.length ? grouped["floor_usage_type"]! : FLOOR_USAGE_TYPES,
      constructionTypes: grouped["construction_type"]?.length ? grouped["construction_type"]! : CONSTRUCTION_TYPES,
      floors: mergeMasterOptions(FLOOR_NAMES, grouped["floor_name"]),
    }
  },
})

/** Wards for one ULB — used by survey start when the bundle list is incomplete. */
export const wardsForMunicipality = query({
  args: { municipalityId: v.id("municipalities") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const [muni, rows] = await Promise.all([
      assertMunicipalityInScope(ctx, me, args.municipalityId),
      ctx.db
        .query("wards")
        .withIndex("by_municipality_ward", (q) => q.eq("municipalityId", args.municipalityId))
        .collect(),
    ])
    const wards = rows
      .sort((a, b) => a.wardNo.localeCompare(b.wardNo, undefined, { numeric: true }))
      .map((w) => ({
        _id: w._id,
        municipalityId: w.municipalityId,
        municipalityCode: muni.code,
        wardNo: w.wardNo,
        wardCode: w.wardCode ?? w.wardNo,
        name: w.name,
      }))
    return filterWardsForUser(me, wards)
  },
})

/** Read-only scope summary for field users (mobile/web diagnostics). */
export const myTenantScope = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx)
    const [scope, allotments] = await Promise.all([
      resolveTenantScope(ctx, me),
      ctx.db
        .query("userAllotments")
        .withIndex("by_user", (q) => q.eq("userId", me._id))
        .collect(),
    ])

    const activeAllotments: { districtId: Id<"districts"> | null; municipalityId: Id<"municipalities"> | null }[] = []
    for (const a of allotments) {
      if (!a.isActive) continue
      activeAllotments.push({
        districtId: a.districtId ?? null,
        municipalityId: a.municipalityId ?? null,
      })
    }

    return {
      role: me.role,
      primaryMunicipalityId: me.municipalityId ?? null,
      primaryDistrictId: me.districtId ?? null,
      wardAssignments: me.wardAssignments,
      districts: scope.districts.map((d) => ({ _id: d._id, code: d.code, name: d.name })),
      municipalities: scope.municipalities.map((m) => ({ _id: m._id, code: m.code, name: m.name })),
      activeAllotments,
    }
  },
})

export const listNotifications = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const limit = Math.min(args.limit ?? 30, 100)
    return await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .order("desc")
      .take(limit)
  },
})

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx, { allowPending: true })
    // Before: unbounded `.collect()` of unread → grows with notification history.
    // After: capped take; badge semantics unchanged for practical counts.
    const UNREAD_BADGE_CAP = 100
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", me._id).eq("readAt", undefined))
      .take(UNREAD_BADGE_CAP)
    return rows.length
  },
})

const dashboardCountsShape = {
  total: v.number(),
  today: v.number(),
  drafts: v.number(),
  pending: v.number(),
  submittedToday: v.number(),
  approved: v.number(),
  submitted: v.number(),
  rejected: v.number(),
}

/**
 * Quick KPI counts for the home screen. Scoped to whatever the caller
 * can see — surveyor sees own, supervisor sees ULB, admin sees all.
 */
export const dashboardCounts = query({
  // Require client clock — Date.now() in queries breaks caching/reactivity.
  args: { nowMs: v.number() },
  returns: v.object(dashboardCountsShape),
  handler: async (ctx, args) => {
    const me = await requireUser(ctx, { allowPending: true })
    if (me.status !== "active") {
      return { total: 0, today: 0, drafts: 0, pending: 0, submittedToday: 0, approved: 0, submitted: 0, rejected: 0 }
    }

    const todayMs = startOfDayMs(args.nowMs)
    return loadDashboardCountsForHome(ctx, me, todayMs)
  },
})

/**
 * masterCatalog — admin READ over raw `masters` rows.
 *
 * WHY: `masters.bundle` returns only ACTIVE, normalized dropdown options for
 * the survey forms — it deliberately hides inactive rows and drops position/id.
 * The web Masters CRUD screen needs the raw rows (including inactive ones, with
 * `position` and `_id`) to render a sortable, toggleable table.
 */
export const listByCategory = mastersManageQuery({
  args: { category: v.string() },
  handler: async (ctx, args) => {
    const storageCategory = resolveMasterCategory(args.category)
    const rows = await ctx.db
      .query("masters")
      .withIndex("by_category_position", (q) => q.eq("category", storageCategory))
      .collect()
    if (rows.length > 0) {
      return rows
        .sort((a, b) => a.position - b.position)
        .map((m) => ({
          _id: m._id,
          category: m.category,
          value: m.value,
          label: m.label,
          position: m.position,
          isActive: m.isActive,
        }))
    }

    // Match `masters.bundle`: show canonical defaults until an admin persists edits.
    return defaultMasterRowsForCategory(storageCategory).map((m) => ({
      category: storageCategory,
      value: m.value,
      label: m.label,
      position: m.position,
      isActive: true,
    }))
  },
})

/** Read-only tenant labels + admin PIN for the address wizard step. */
export const contextForMunicipality = query({
  args: { municipalityId: v.id("municipalities") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    const muni = await assertMunicipalityInScope(ctx, me, args.municipalityId)
    const district = await ctx.db.get(muni.districtId)
    const ctxOut = addressTenantContext(muni, district)
    return {
      ...ctxOut,
      configuredPostalCode: muni.postalCode ?? null,
    }
  },
})

/** Mobile dropdown source — single source of truth for respondent relationship. */
export const respondentRelationships = query({
  args: {},
  returns: v.object({
    options: v.array(v.object({ value: v.string(), label: v.string() })),
    maxOwners: v.number(),
  }),
  handler: async (ctx) => {
    await requireIdentity(ctx)
    return {
      options: RESPONDENT_RELATIONSHIPS,
      maxOwners: MAX_SURVEY_OWNERS,
    }
  },
})
