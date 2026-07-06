import { v } from "convex/values"
import type { Id } from "../_generated/dataModel"
import { internalMutation } from "../_generated/server"
import {
  mergeActorSnapshotIntoMetadata,
  readActorSnapshotFromMetadata,
  readReassignmentFromMetadata,
} from "../lib/auditActor"

/** One-time backfill: snapshot actor names on legacy rows where the user still exists. */
export const backfillActorSnapshots = internalMutation({
  args: { batchSize: v.optional(v.number()) },
  returns: v.object({ patched: v.number(), scanned: v.number() }),
  handler: async (ctx, args) => {
    const batchSize = Math.min(args.batchSize ?? 200, 500)
    const rows = await ctx.db.query("auditLogs").withIndex("by_creation_time").order("desc").take(batchSize)

    let patched = 0
    for (const row of rows) {
      let metadata = row.metadata
      let changed = false

      if (row.actorId && !readActorSnapshotFromMetadata(metadata).actorName) {
        const actor = await ctx.db.get("users", row.actorId)
        if (actor) {
          metadata = mergeActorSnapshotIntoMetadata(metadata, {
            actorName: actor.name,
            actorEmail: actor.email,
          })
          changed = true
        }
      }

      if (row.action === "survey.draft_reassigned") {
        const reassign = readReassignmentFromMetadata(metadata)
        const updates: Record<string, string> = {}
        if (reassign.fromSurveyorId && !reassign.fromSurveyorName) {
          const from = await ctx.db.get("users", reassign.fromSurveyorId)
          if (from) updates.fromSurveyorName = from.name
        }
        const toId =
          metadata && typeof metadata === "object" && !Array.isArray(metadata)
            ? (metadata as Record<string, unknown>).toSurveyorId
            : undefined
        const toName =
          metadata && typeof metadata === "object" && !Array.isArray(metadata)
            ? (metadata as Record<string, unknown>).toSurveyorName
            : undefined
        if (typeof toId === "string" && typeof toName !== "string") {
          const to = await ctx.db.get("users", toId as Id<"users">)
          if (to) updates.toSurveyorName = to.name
        }
        if (Object.keys(updates).length > 0) {
          metadata = {
            ...(metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {}),
            ...updates,
          }
          changed = true
        }
      }

      if (changed) {
        await ctx.db.patch(row._id, { metadata })
        patched += 1
      }
    }

    return { patched, scanned: rows.length }
  },
})
