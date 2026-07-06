import { v } from "convex/values"
import type { Doc, Id } from "../_generated/dataModel"
import { mutation } from "../_generated/server"
import { requireCapability } from "../shared/capabilities"
import { clientError, requireUser, writeAudit } from "../shared/helpers"
import {
  assertTargetCoversSurvey,
  collectDraftsInAdminScope,
  isTransferableDraft,
  loadTargetSurveyor,
  reassignResult,
  resolveLocalIdForTransfer,
} from "./helpers"

/**
 * Transfer draft surveys to another field collector.
 *
 * Modes:
 *  - `fromSurveyor` — all drafts for `fromSurveyorId` (optional ULB/ward filters)
 *  - `orphaned`     — drafts whose assignee is disabled / non-field
 *  - `selected`     — explicit `surveyIds` list
 */
export const reassignDrafts = mutation({
  args: {
    toSurveyorId: v.id("users"),
    mode: v.union(v.literal("fromSurveyor"), v.literal("orphaned"), v.literal("selected")),
    fromSurveyorId: v.optional(v.id("users")),
    surveyIds: v.optional(v.array(v.id("surveys"))),
    districtId: v.optional(v.id("districts")),
    municipalityId: v.optional(v.id("municipalities")),
    wardNo: v.optional(v.string()),
  },
  returns: reassignResult,
  handler: async (ctx, args) => {
    const [me, target] = await Promise.all([requireUser(ctx), loadTargetSurveyor(ctx, args.toSurveyorId)])
    await requireCapability(ctx, me, "surveys.reassign")
    if (args.toSurveyorId === args.fromSurveyorId) {
      clientError("BAD_REQUEST", "Source and target surveyor must differ")
    }

    let drafts: Doc<"surveys">[] = []

    if (args.mode === "selected") {
      if (!args.surveyIds?.length) {
        clientError("BAD_REQUEST", "Select at least one draft survey")
      }
      const rows = await Promise.all(args.surveyIds.map((id) => ctx.db.get(id)))
      drafts = rows.filter((r): r is Doc<"surveys"> => r != null && isTransferableDraft(r))
      if (drafts.length !== args.surveyIds.length) {
        clientError("BAD_REQUEST", "Only draft surveys can be reassigned")
      }
      const scoped = await collectDraftsInAdminScope(ctx, me, {
        districtId: args.districtId,
        municipalityId: args.municipalityId,
        wardNo: args.wardNo,
      })
      const allowed = new Set(scoped.map((s) => s._id))
      drafts = drafts.filter((s) => allowed.has(s._id))
      if (drafts.length !== args.surveyIds.length) {
        clientError("FORBIDDEN", "One or more surveys are outside your reassignment scope")
      }
    } else if (args.mode === "fromSurveyor") {
      if (!args.fromSurveyorId) {
        clientError("BAD_REQUEST", "Select the surveyor whose drafts should move")
      }
      drafts = await collectDraftsInAdminScope(ctx, me, {
        fromSurveyorId: args.fromSurveyorId,
        districtId: args.districtId,
        municipalityId: args.municipalityId,
        wardNo: args.wardNo,
      })
    } else {
      drafts = await collectDraftsInAdminScope(ctx, me, {
        orphanedOnly: true,
        districtId: args.districtId,
        municipalityId: args.municipalityId,
        wardNo: args.wardNo,
      })
    }

    if (drafts.length === 0) {
      clientError("BAD_REQUEST", "No draft surveys matched this reassignment")
    }

    let transferred = 0
    let skipped = 0
    let localIdAdjusted = 0
    const now = Date.now()

    for (const survey of drafts) {
      if (survey.surveyorId === args.toSurveyorId) {
        skipped += 1
        continue
      }

      try {
        await assertTargetCoversSurvey(ctx, target, survey)
      } catch {
        skipped += 1
        continue
      }

      const { localId, adjusted } = await resolveLocalIdForTransfer(ctx, args.toSurveyorId, survey.localId, survey._id)
      if (adjusted) localIdAdjusted += 1

      const fromSurveyorId = survey.surveyorId
      const [fromSurveyor, toSurveyor] = await Promise.all([
        ctx.db.get("users", fromSurveyorId),
        ctx.db.get("users", args.toSurveyorId),
      ])

      await Promise.all([
        ctx.db.patch(survey._id, {
          surveyorId: args.toSurveyorId,
          localId,
          serverVersion: survey.serverVersion + 1,
          clientUpdatedAt: now,
        }),
        ctx.db.insert("notifications", {
          userId: args.toSurveyorId,
          type: "survey_draft_assigned",
          title: "Draft surveys assigned to you",
          body: `A draft in Ward ${survey.wardNo || "—"} was assigned by an administrator.`,
          relatedEntity: "survey",
          relatedId: survey._id,
        }),
        writeAudit(ctx, {
          actorId: me._id,
          action: "survey.draft_reassigned",
          entity: "survey",
          entityId: survey._id,
          metadata: {
            fromSurveyorId,
            fromSurveyorName: fromSurveyor?.name,
            toSurveyorId: args.toSurveyorId,
            toSurveyorName: toSurveyor?.name,
            mode: args.mode,
            localIdAdjusted: adjusted,
            wardNo: survey.wardNo,
            municipalityId: survey.municipalityId,
          },
        }),
      ])

      transferred += 1
    }

    if (transferred === 0) {
      clientError("BAD_REQUEST", "No drafts could be transferred — check target ULB/ward scope")
    }

    return { transferred, skipped, localIdAdjusted }
  },
})
