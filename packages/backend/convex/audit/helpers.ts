import type { Doc, Id } from "../_generated/dataModel"
import type { QueryCtx } from "../_generated/server"
import { readReassignmentFromMetadata, resolveAuditActor } from "../lib/auditActor"
import { mapTruthyById } from "../shared/helpers"

export async function hydrateAuditRows(ctx: QueryCtx, rows: Doc<"auditLogs">[]) {
  const actorIdSet = new Set<Id<"users">>()
  for (const row of rows) {
    if (row.actorId) actorIdSet.add(row.actorId)
    const reassign = readReassignmentFromMetadata(row.metadata)
    if (reassign.fromSurveyorId) actorIdSet.add(reassign.fromSurveyorId)
  }

  const actors = await Promise.all([...actorIdSet].map((id) => ctx.db.get("users", id)))
  const byId = mapTruthyById(actors)

  /** When creator user was deleted, infer from a later draft reassignment on the same survey. */
  const priorSurveyorBySurvey = new Map<string, string>()
  for (const row of rows) {
    if (row.action !== "survey.draft_reassigned" || row.entity !== "survey" || !row.entityId) continue
    const reassign = readReassignmentFromMetadata(row.metadata)
    if (reassign.fromSurveyorName) {
      priorSurveyorBySurvey.set(row.entityId, reassign.fromSurveyorName)
      continue
    }
    if (reassign.fromSurveyorId) {
      const fromUser = byId.get(reassign.fromSurveyorId)
      if (fromUser) priorSurveyorBySurvey.set(row.entityId, fromUser.name)
    }
  }

  return rows.map((r) => {
    let actor = resolveAuditActor(r.actorId, r.actorId ? byId.get(r.actorId) : undefined, r.metadata)

    if (actor?.name === "Unknown" && r.action === "survey.created" && r.entity === "survey" && r.entityId) {
      const inferred = priorSurveyorBySurvey.get(r.entityId)
      if (inferred && actor) {
        actor = { ...actor, name: inferred }
      }
    }

    return {
      _id: r._id,
      _creationTime: r._creationTime,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId ?? null,
      metadata: r.metadata ?? null,
      actor,
    }
  })
}

export function auditQuery(ctx: QueryCtx, args: { entity?: string; entityId?: string; actorId?: Id<"users"> }) {
  if (args.entity) {
    return ctx.db
      .query("auditLogs")
      .withIndex("by_entity", (q) =>
        args.entityId ? q.eq("entity", args.entity!).eq("entityId", args.entityId) : q.eq("entity", args.entity!)
      )
  }
  if (args.actorId) {
    return ctx.db.query("auditLogs").withIndex("by_actor", (q) => q.eq("actorId", args.actorId!))
  }
  return ctx.db.query("auditLogs")
}
