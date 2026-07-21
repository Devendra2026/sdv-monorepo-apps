/**
 * Multi-district / multi-ULB allotments for supervisors and surveyors.
 * Example: supervisor active on Agra MC + Mathura MC + Hathras district-wide.
 */
import type { Id } from "../_generated/dataModel"
import { type MutationCtx } from "../_generated/server"
import { clientError } from "../shared/helpers"

async function validateAllotmentTarget(
  ctx: MutationCtx,
  row: { districtId?: Id<"districts">; municipalityId?: Id<"municipalities"> }
): Promise<{ districtId?: Id<"districts">; municipalityId?: Id<"municipalities"> }> {
  if (!row.districtId && !row.municipalityId) {
    clientError("BAD_REQUEST", "Each allotment needs a district or a municipality")
  }
  if (row.municipalityId) {
    const muni = await ctx.db.get(row.municipalityId)
    if (!muni || muni.isActive === false) {
      clientError("BAD_REQUEST", "Unknown or inactive municipality")
    }
    return { municipalityId: row.municipalityId, districtId: muni.districtId }
  }
  const dist = await ctx.db.get(row.districtId!)
  if (!dist || dist.isActive === false) {
    clientError("BAD_REQUEST", "Unknown or inactive district")
  }
  return { districtId: row.districtId }
}

type AllotmentRow = {
  districtId?: Id<"districts">
  municipalityId?: Id<"municipalities">
  isActive: boolean
}

/** Replace all allotments for a field user (shared by admin approve + setForUser). */
export async function replaceUserAllotments(
  ctx: MutationCtx,
  opts: {
    userId: Id<"users">
    allotments: AllotmentRow[]
    assignedBy: Id<"users">
  }
): Promise<void> {
  const existing = await ctx.db
    .query("userAllotments")
    .withIndex("by_user", (q) => q.eq("userId", opts.userId))
    .collect()
  await Promise.all(existing.map((row) => ctx.db.delete(row._id)))

  const validated = await Promise.all(
    opts.allotments.map(async (a) => ({
      a,
      normalized: await validateAllotmentTarget(ctx, a),
    }))
  )

  const now = Date.now()
  const activeMunis: Id<"municipalities">[] = []
  let primaryDistrict: Id<"districts"> | undefined
  const existingUser = await ctx.db.get(opts.userId)

  await Promise.all(
    validated.map(({ a, normalized }) =>
      ctx.db.insert("userAllotments", {
        userId: opts.userId,
        districtId: normalized.districtId,
        municipalityId: normalized.municipalityId,
        isActive: a.isActive,
        assignedBy: opts.assignedBy,
        assignedAt: now,
      })
    )
  )

  for (const { a, normalized } of validated) {
    if (a.isActive) {
      if (normalized.municipalityId) activeMunis.push(normalized.municipalityId)
      if (normalized.districtId) primaryDistrict = normalized.districtId
    }
  }

  const patch: {
    municipalityId?: Id<"municipalities">
    districtId?: Id<"districts">
  } = {}

  if (activeMunis.length > 0) {
    const keepPrimary =
      existingUser?.municipalityId && activeMunis.includes(existingUser.municipalityId)
        ? existingUser.municipalityId
        : activeMunis[0]!
    patch.municipalityId = keepPrimary
    const m = await ctx.db.get(keepPrimary)
    if (m) patch.districtId = m.districtId
  } else if (primaryDistrict) {
    patch.districtId = primaryDistrict
    patch.municipalityId = undefined
  }

  if (Object.keys(patch).length > 0) {
    await ctx.db.patch(opts.userId, patch)
  }
}

/** Upsert one allotment row (used by assignTenant). */
export async function upsertAllotmentForUser(
  ctx: import("../_generated/server").MutationCtx,
  opts: {
    userId: Id<"users">
    municipalityId?: Id<"municipalities">
    districtId?: Id<"districts">
    assignedBy: Id<"users">
    isActive?: boolean
  }
): Promise<void> {
  const [normalized, existing] = await Promise.all([
    validateAllotmentTarget(ctx, {
      municipalityId: opts.municipalityId,
      districtId: opts.districtId,
    }),
    ctx.db
      .query("userAllotments")
      .withIndex("by_user", (q) => q.eq("userId", opts.userId))
      .collect(),
  ])

  const match = existing.find((r) => {
    if (normalized.municipalityId) {
      return r.municipalityId === normalized.municipalityId
    }
    return !r.municipalityId && r.districtId === normalized.districtId
  })

  const now = Date.now()
  const isActive = opts.isActive ?? true

  if (match) {
    await ctx.db.patch(match._id, { isActive, assignedBy: opts.assignedBy, assignedAt: now })
    return
  }

  await ctx.db.insert("userAllotments", {
    userId: opts.userId,
    districtId: normalized.districtId,
    municipalityId: normalized.municipalityId,
    isActive,
    assignedBy: opts.assignedBy,
    assignedAt: now,
  })
}
