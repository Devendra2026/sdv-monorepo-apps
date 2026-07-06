import { v } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import { query } from "../_generated/server"
import { requireCapability } from "../shared/capabilities"
import { requireUser } from "../shared/helpers"
import { collectDraftsInAdminScope, draftOwnerRow, isOrphanedAssignee } from "./helpers"

/** Draft counts grouped by current assignee — drives admin reassignment picker. */
export const listDraftOwners = query({
  args: {
    districtId: v.optional(v.id("districts")),
    municipalityId: v.optional(v.id("municipalities")),
    wardNo: v.optional(v.string()),
  },
  returns: v.object({
    owners: v.array(draftOwnerRow),
    orphanedCount: v.number(),
    totalDrafts: v.number(),
  }),
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    await requireCapability(ctx, me, "surveys.reassign")

    const drafts = await collectDraftsInAdminScope(ctx, me, args)
    const bySurveyor = new Map<Id<"users">, number>()
    for (const row of drafts) {
      bySurveyor.set(row.surveyorId, (bySurveyor.get(row.surveyorId) ?? 0) + 1)
    }

    const owners = await Promise.all(
      [...bySurveyor.entries()].map(async ([surveyorId, draftCount]) => {
        const user = await ctx.db.get(surveyorId)
        const orphaned = isOrphanedAssignee(user)
        return {
          surveyorId,
          name: user?.name ?? "Unknown user",
          email: user?.email ?? "",
          role: user?.role ?? "unknown",
          status: user?.status ?? "unknown",
          draftCount,
          isOrphaned: orphaned,
        }
      })
    )

    owners.sort((a, b) => {
      if (a.isOrphaned !== b.isOrphaned) return a.isOrphaned ? -1 : 1
      return b.draftCount - a.draftCount
    })

    const orphanedCount = owners.filter((o) => o.isOrphaned).reduce((n, o) => n + o.draftCount, 0)
    return { owners, orphanedCount, totalDrafts: drafts.length }
  },
})

/** Count drafts per ward for QC command center (includes unsubmitted field work). */
export const wardDraftCounts = query({
  args: {
    districtId: v.optional(v.id("districts")),
    municipalityId: v.optional(v.id("municipalities")),
  },
  returns: v.array(
    v.object({
      municipalityId: v.id("municipalities"),
      wardNo: v.string(),
      draftCount: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    await requireCapability(ctx, me, "qc.review")

    const drafts = await collectDraftsInAdminScope(ctx, me, {
      districtId: args.districtId,
      municipalityId: args.municipalityId,
    })

    const byKey = new Map<string, { municipalityId: Id<"municipalities">; wardNo: string; draftCount: number }>()
    for (const row of drafts) {
      if (!row.wardNo) continue
      const key = `${row.municipalityId}:${row.wardNo}`
      const entry = byKey.get(key)
      if (entry) {
        entry.draftCount += 1
      } else {
        byKey.set(key, { municipalityId: row.municipalityId, wardNo: row.wardNo, draftCount: 1 })
      }
    }

    return Array.from(byKey.values()).toSorted((a, b) => a.wardNo.localeCompare(b.wardNo, undefined, { numeric: true }))
  },
})
