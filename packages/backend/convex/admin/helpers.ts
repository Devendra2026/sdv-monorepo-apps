/**
 * Admin-only operations — shared helpers.
 */
import { ConvexError, v } from "convex/values"
import type { Doc } from "../_generated/dataModel"
import type { QueryCtx } from "../_generated/server"
import { hasCapability } from "../shared/capabilities"
import { clientError } from "../shared/helpers"

export const allotmentInput = v.object({
  districtId: v.optional(v.id("districts")),
  municipalityId: v.optional(v.id("municipalities")),
  isActive: v.boolean(),
})

/** Capability checks for `updateUser` — supports custom roles, not only `role === "admin"`. */
export async function assertCanPatchUser(
  ctx: Parameters<typeof hasCapability>[0],
  me: Doc<"users">,
  args: {
    role?: string
    status?: "active" | "disabled"
    municipalityId?: unknown
    districtId?: unknown
    wardAssignments?: unknown
  }
): Promise<void> {
  const required: string[] = []
  if (args.status !== undefined) required.push("users.disable")
  if (args.role !== undefined) required.push("users.approve")
  if (args.municipalityId !== undefined || args.districtId !== undefined || args.wardAssignments !== undefined) {
    required.push("users.assignTenant")
  }
  if (required.length === 0) return

  const allowed = await Promise.all(required.map((cap) => hasCapability(ctx, me, cap)))
  if (!allowed.every(Boolean)) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "You don't have permission for this action.",
    })
  }
}

/** Read paths that list or hydrate user rows for admin UI and survey reassignment. */
export async function assertCanListUsers(ctx: QueryCtx, me: Doc<"users">): Promise<void> {
  const canList =
    (await hasCapability(ctx, me, "users.view")) ||
    (await hasCapability(ctx, me, "users.approve")) ||
    (await hasCapability(ctx, me, "surveys.viewAll")) ||
    (await hasCapability(ctx, me, "surveys.reassign"))
  if (!canList) {
    clientError("FORBIDDEN", "You don't have permission for this action.")
  }
}

async function buildScopeLabel(
  ctx: QueryCtx,
  user: Doc<"users">,
  districts: Map<string, string>,
  munis: Map<string, { name: string; code: string; districtId: string }>
): Promise<string | null> {
  const allotmentRows = await ctx.db
    .query("userAllotments")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect()
  const active = allotmentRows.filter((r) => r.isActive)

  const muniNames = new Set<string>()
  const districtNames = new Set<string>()

  const missingMuniIds = new Set<NonNullable<(typeof active)[number]["municipalityId"]>>()
  const missingDistrictIds = new Set<NonNullable<(typeof active)[number]["districtId"]>>()
  for (const row of active) {
    if (row.municipalityId && !munis.has(row.municipalityId)) {
      missingMuniIds.add(row.municipalityId)
    } else if (row.districtId && !row.municipalityId && !districts.has(row.districtId)) {
      missingDistrictIds.add(row.districtId)
    }
  }

  const [missingMuniDocs, missingDistrictDocs] = await Promise.all([
    Promise.all([...missingMuniIds].map((id) => ctx.db.get(id))),
    Promise.all([...missingDistrictIds].map((id) => ctx.db.get(id))),
  ])
  for (const doc of missingMuniDocs) {
    if (doc) munis.set(doc._id, { name: doc.name, code: doc.code, districtId: doc.districtId })
  }
  for (const doc of missingDistrictDocs) {
    if (doc) districts.set(doc._id, doc.name)
  }

  for (const row of active) {
    if (row.municipalityId) {
      const m = munis.get(row.municipalityId)
      if (m) muniNames.add(m.name)
    } else if (row.districtId) {
      const name = districts.get(row.districtId)
      if (name) districtNames.add(`${name} (district)`)
    }
  }

  if (user.municipalityId) {
    const primary = munis.get(user.municipalityId)?.name
    if (primary) muniNames.add(primary)
  }
  if (user.districtId && muniNames.size === 0) {
    const name = districts.get(user.districtId)
    if (name) districtNames.add(`${name} (district)`)
  }

  const parts = [...muniNames, ...districtNames]
  return parts.length > 0 ? parts.join(", ") : null
}

export async function hydrateUsersForAdmin(ctx: QueryCtx, rows: Doc<"users">[]) {
  const munis = new Map<string, { name: string; code: string; districtId: string }>()
  const districts = new Map<string, string>()
  const missingDistrictIds = new Set<NonNullable<(typeof rows)[number]["districtId"]>>()
  const missingMuniIds = new Set<NonNullable<(typeof rows)[number]["municipalityId"]>>()
  for (const u of rows) {
    if (u.districtId && !districts.has(u.districtId)) missingDistrictIds.add(u.districtId)
    if (u.municipalityId && !munis.has(u.municipalityId)) missingMuniIds.add(u.municipalityId)
  }
  const [missingDistrictDocs, missingMuniDocs] = await Promise.all([
    Promise.all([...missingDistrictIds].map((id) => ctx.db.get(id))),
    Promise.all([...missingMuniIds].map((id) => ctx.db.get(id))),
  ])
  for (const d of missingDistrictDocs) {
    if (d) districts.set(d._id, d.name)
  }
  for (const m of missingMuniDocs) {
    if (m) munis.set(m._id, { name: m.name, code: m.code, districtId: m.districtId })
  }

  const scopeLabels = await Promise.all(rows.map((u) => buildScopeLabel(ctx, u, districts, munis)))

  return rows.map((u, i) => ({
    _id: u._id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    districtId: u.districtId,
    municipalityId: u.municipalityId,
    wardAssignments: u.wardAssignments,
    districtName: u.districtId ? (districts.get(u.districtId) ?? null) : null,
    municipalityName: u.municipalityId ? (munis.get(u.municipalityId)?.name ?? null) : null,
    municipalityCode: u.municipalityId ? (munis.get(u.municipalityId)?.code ?? null) : null,
    scopeLabel: scopeLabels[i] ?? null,
    lastSeenAt: u.lastSeenAt,
    createdAt: u._creationTime,
  }))
}
