/**
 * Shared tenant-scope resolution for queries and mutations.
 */
import { ConvexError } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { roleRequiresTenancy } from "./capabilities"

function isActive<T extends { isActive?: boolean }>(row: T): boolean {
  return row.isActive !== false
}

async function loadActiveDistricts(ctx: QueryCtx): Promise<Doc<"districts">[]> {
  return ctx.db
    .query("districts")
    .withIndex("by_active", (q) => q.eq("isActive", true))
    .collect()
}

async function loadActiveMunicipalitiesForDistricts(
  ctx: QueryCtx,
  districtIds: Id<"districts">[]
): Promise<Doc<"municipalities">[]> {
  if (districtIds.length === 0) return []
  const batches = await Promise.all(
    districtIds.map((districtId) =>
      ctx.db
        .query("municipalities")
        .withIndex("by_district_active", (q) => q.eq("districtId", districtId).eq("isActive", true))
        .collect()
    )
  )
  return batches.flat()
}

async function loadActiveCatalog(ctx: QueryCtx): Promise<{
  districts: Doc<"districts">[]
  municipalities: Doc<"municipalities">[]
}> {
  const districts = await loadActiveDistricts(ctx)
  const municipalities = await loadActiveMunicipalitiesForDistricts(
    ctx,
    districts.map((d) => d._id)
  )
  return { districts, municipalities }
}

/**
 * Admin dashboard catalog includes inactive districts/ULBs so survey counts match
 * Convex document totals (surveys may still reference deactivated municipalities).
 */
async function loadAdminDashboardCatalog(ctx: QueryCtx): Promise<{
  districts: Doc<"districts">[]
  municipalities: Doc<"municipalities">[]
}> {
  const [districts, municipalities] = await Promise.all([
    ctx.db.query("districts").collect(),
    ctx.db.query("municipalities").collect(),
  ])
  return { districts, municipalities }
}

/** Multi-district / multi-ULB scope from userAllotments (indexed lookups, no full catalog scan). */
async function resolveScopeFromAllotmentsTargeted(
  ctx: QueryCtx,
  me: Doc<"users">
): Promise<{ districts: Doc<"districts">[]; municipalities: Doc<"municipalities">[] } | null> {
  const rows = await ctx.db
    .query("userAllotments")
    .withIndex("by_user_active", (q) => q.eq("userId", me._id).eq("isActive", true))
    .collect()

  if (rows.length === 0) return null

  const districtIds = new Set<Id<"districts">>()
  const municipalityIds = new Set<Id<"municipalities">>()

  for (const row of rows) {
    if (row.municipalityId) {
      municipalityIds.add(row.municipalityId)
    } else if (row.districtId) {
      districtIds.add(row.districtId)
    }
  }

  for (const districtId of districtIds) {
    const munis = await loadActiveMunicipalitiesForDistricts(ctx, [districtId])
    for (const m of munis) municipalityIds.add(m._id)
  }

  const municipalityDocs = (await Promise.all([...municipalityIds].map((id) => ctx.db.get(id)))).filter(
    (m): m is Doc<"municipalities"> => m !== null && isActive(m)
  )
  for (const muni of municipalityDocs) {
    districtIds.add(muni.districtId)
  }

  const districtDocs = (await Promise.all([...districtIds].map((id) => ctx.db.get(id)))).filter(
    (d): d is Doc<"districts"> => d !== null && isActive(d)
  )

  if (municipalityDocs.length === 0 && districtDocs.length === 0) return null

  return { districts: districtDocs, municipalities: municipalityDocs }
}

/** Union profile tenant ids with an allotment-derived scope. */
async function mergeScopeWithProfileTargeted(
  ctx: QueryCtx,
  scope: { districts: Doc<"districts">[]; municipalities: Doc<"municipalities">[] },
  me: Doc<"users">
): Promise<{ districts: Doc<"districts">[]; municipalities: Doc<"municipalities">[] }> {
  const districtIds = new Set(scope.districts.map((d) => d._id))
  const municipalityIds = new Set(scope.municipalities.map((m) => m._id))
  const districts = new Map(scope.districts.map((d) => [d._id, d]))
  const municipalities = new Map(scope.municipalities.map((m) => [m._id, m]))

  if (me.municipalityId) {
    const muni = await ctx.db.get(me.municipalityId)
    if (muni && isActive(muni)) {
      municipalityIds.add(muni._id)
      municipalities.set(muni._id, muni)
      const district = await ctx.db.get(muni.districtId)
      if (district && isActive(district)) {
        districtIds.add(district._id)
        districts.set(district._id, district)
      }
    }
  }

  if (me.districtId) {
    const district = await ctx.db.get(me.districtId)
    if (district && isActive(district)) {
      districtIds.add(district._id)
      districts.set(district._id, district)
      const munis = await loadActiveMunicipalitiesForDistricts(ctx, [me.districtId])
      for (const m of munis) {
        municipalityIds.add(m._id)
        municipalities.set(m._id, m)
      }
    }
  }

  return {
    districts: [...districtIds].map((id) => districts.get(id)).filter((d): d is Doc<"districts"> => d !== undefined),
    municipalities: [...municipalityIds]
      .map((id) => municipalities.get(id))
      .filter((m): m is Doc<"municipalities"> => m !== undefined),
  }
}

/** Resolve ULBs/districts from ward numbers when profile tenant ids are missing. */
async function scopeFromWardAssignmentsTargeted(
  ctx: QueryCtx,
  me: Doc<"users">
): Promise<{ districts: Doc<"districts">[]; municipalities: Doc<"municipalities">[] } | null> {
  if (me.wardAssignments.length === 0) return null

  const wardSet = new Set(me.wardAssignments)
  const candidateMuniIds = new Set<Id<"municipalities">>()
  if (me.municipalityId) candidateMuniIds.add(me.municipalityId)

  const allotmentRows = await ctx.db
    .query("userAllotments")
    .withIndex("by_user_active", (q) => q.eq("userId", me._id).eq("isActive", true))
    .collect()
  for (const row of allotmentRows) {
    if (row.municipalityId) {
      candidateMuniIds.add(row.municipalityId)
    } else if (row.districtId) {
      const munis = await loadActiveMunicipalitiesForDistricts(ctx, [row.districtId])
      for (const m of munis) candidateMuniIds.add(m._id)
    }
  }
  if (candidateMuniIds.size === 0 && me.districtId) {
    const munis = await loadActiveMunicipalitiesForDistricts(ctx, [me.districtId])
    for (const m of munis) candidateMuniIds.add(m._id)
  }

  const candidateMunis = (await Promise.all([...candidateMuniIds].map((id) => ctx.db.get(id)))).filter(
    (m): m is Doc<"municipalities"> => m !== null && isActive(m)
  )

  const wardBatches = await Promise.all(
    candidateMunis.map((muni) =>
      ctx.db
        .query("wards")
        .withIndex("by_municipality", (q) => q.eq("municipalityId", muni._id))
        .collect()
    )
  )
  const matched: Doc<"wards">[] = []
  for (const rows of wardBatches) {
    for (const w of rows) {
      if (wardSet.has(w.wardNo)) matched.push(w)
    }
  }
  if (matched.length === 0) return null

  const muniIds = new Set(matched.map((w) => w.municipalityId))
  const municipalities = candidateMunis.filter((m) => muniIds.has(m._id))
  if (municipalities.length === 0) return null

  const districtIds = new Set(municipalities.map((m) => m.districtId))
  const districts = (await Promise.all([...districtIds].map((id) => ctx.db.get(id)))).filter(
    (d): d is Doc<"districts"> => d !== null && isActive(d)
  )

  return { districts, municipalities }
}

/** District id from user row or their assigned ULB. */
export async function effectiveDistrictId(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">
): Promise<Id<"districts"> | undefined> {
  if (user.districtId) {
    const dist = await ctx.db.get(user.districtId)
    if (dist && isActive(dist)) return user.districtId
  }
  if (user.municipalityId) {
    const muni = await ctx.db.get(user.municipalityId)
    if (muni && isActive(muni)) return muni.districtId
  }
  return undefined
}

/** Districts and ULBs visible to the signed-in user (multitenant isolation). */
export async function resolveTenantScope(
  ctx: QueryCtx,
  me: Doc<"users">
): Promise<{ districts: Doc<"districts">[]; municipalities: Doc<"municipalities">[] }> {
  // Field roles with no allotment/profile must get empty scope — never the full catalog.
  // (Previous allowCatalogFallback:true over-granted cross-tenant reads.)
  return resolveTenantScopeInternal(ctx, me, { allowCatalogFallback: false })
}

/**
 * Strict tenant scope for dashboard KPIs and analytics.
 * Never grants the full seeded catalog when profile/allotment data is missing.
 * Admin includes inactive ULBs so totals match all survey documents.
 */
export async function resolveDashboardTenantScope(
  ctx: QueryCtx,
  me: Doc<"users">
): Promise<{ districts: Doc<"districts">[]; municipalities: Doc<"municipalities">[] }> {
  if (me.role === "admin") {
    return loadAdminDashboardCatalog(ctx)
  }
  return resolveTenantScopeInternal(ctx, me, { allowCatalogFallback: false })
}

async function resolveTenantScopeInternal(
  ctx: QueryCtx,
  me: Doc<"users">,
  options: { allowCatalogFallback: boolean }
): Promise<{ districts: Doc<"districts">[]; municipalities: Doc<"municipalities">[] }> {
  if (me.role === "admin") {
    return loadActiveCatalog(ctx)
  }

  const fromAllotments = await resolveScopeFromAllotmentsTargeted(ctx, me)
  if (fromAllotments && (fromAllotments.municipalities.length > 0 || fromAllotments.districts.length > 0)) {
    return mergeScopeWithProfileTargeted(ctx, fromAllotments, me)
  }

  const [districtId, needsTenancy] = await Promise.all([
    effectiveDistrictId(ctx, me),
    roleRequiresTenancy(ctx, me.role),
  ])

  // Profile-only assignment (no userAllotments rows): single ULB or whole district.
  if (needsTenancy && me.municipalityId) {
    const muni = await ctx.db.get(me.municipalityId)
    if (!muni || !isActive(muni)) {
      return { districts: [], municipalities: [] }
    }
    const district = await ctx.db.get(muni.districtId)
    return {
      districts: district && isActive(district) ? [district] : [],
      municipalities: [muni],
    }
  }

  if (needsTenancy && districtId) {
    const district = await ctx.db.get(districtId)
    if (!district || !isActive(district)) {
      return { districts: [], municipalities: [] }
    }
    const municipalities = await loadActiveMunicipalitiesForDistricts(ctx, [districtId])
    return { districts: [district], municipalities }
  }

  const fromWards = await scopeFromWardAssignmentsTargeted(ctx, me)
  if (fromWards) return fromWards

  if (options.allowCatalogFallback && needsTenancy && me.status === "active") {
    const catalog = await loadActiveCatalog(ctx)
    if (catalog.districts.length > 0) {
      return catalog
    }
  }

  return { districts: [], municipalities: [] }
}

/** District ids the caller may access (Agra, Kasganj, …). */
export function tenantDistrictIds(scope: { districts: Doc<"districts">[] }): Set<Id<"districts">> {
  return new Set(scope.districts.map((d) => d._id))
}

/** ULB ids the caller may access within their tenant scope. */
export function tenantMunicipalityIds(scope: { municipalities: Doc<"municipalities">[] }): Set<Id<"municipalities">> {
  return new Set(scope.municipalities.map((m) => m._id))
}

/**
 * Ensures the user may read/write surveys for this ULB.
 * District-scoped supervisors may access any ULB in their district.
 */
export async function assertMunicipalityInScope(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"users">,
  municipalityId: Id<"municipalities">
): Promise<Doc<"municipalities">> {
  const muni = await ctx.db.get(municipalityId)
  if (!muni || muni.isActive === false) {
    throw new ConvexError({ code: "BAD_REQUEST", message: "Unknown municipality" })
  }

  if (user.role === "admin") return muni

  const scope = await resolveTenantScope(ctx, user)
  if (!tenantMunicipalityIds(scope).has(municipalityId)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "This ULB is outside your allotted municipalities.",
    })
  }

  return muni
}
