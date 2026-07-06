/**
 * QC workflow mutations.
 *
 *  - `decide`        — supervisor/admin approves or rejects; cascades to survey.qcStatus
 *  - `addRemark`     — append-only thread; supervisor and the assigned surveyor
 *                       can both write. Notifies the other party.
 *  - `resolveRemark` — flips a single remark to "resolved" once addressed
 *  - `reopen`        — reopen an approved survey for further editing
 */
import { v } from "convex/values"
import { mutation } from "../_generated/server"
import { recordSurveyStatsUpdate } from "../lib/surveyScopeStats"
import { requireCapability } from "../shared/capabilities"
import { isOwnScopeSurveyor } from "../shared/fieldAccess"
import { assertCanReadWard, clientError, requireUser, writeAudit } from "../shared/helpers"
import { assertMunicipalityInScope } from "../shared/tenancy"

export const addRemark = mutation({
  args: {
    surveyId: v.id("surveys"),
    message: v.string(),
    taggedSections: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    if (args.message.trim().length === 0) {
      clientError("VALIDATION", "Message cannot be empty")
    }
    const survey = await ctx.db.get(args.surveyId)
    if (!survey) clientError("NOT_FOUND", "Survey not found")

    const ownScope = await isOwnScopeSurveyor(ctx, me)
    if (ownScope && survey.surveyorId !== me._id) {
      clientError("FORBIDDEN", "Not your survey")
    }
    if (!ownScope) {
      await requireCapability(ctx, me, "qc.review")
      await assertMunicipalityInScope(ctx, me, survey.municipalityId)
      assertCanReadWard(me, survey.municipalityId, survey.wardNo)
    }

    const remarkId = await ctx.db.insert("qcRemarks", {
      surveyId: args.surveyId,
      authorId: me._id,
      authorRole: me.role,
      message: args.message.trim(),
      taggedSections: args.taggedSections ?? [],
      status: "open",
    })

    const recipientId = ownScope ? null : survey.surveyorId
    if (recipientId) {
      await ctx.db.insert("notifications", {
        userId: recipientId,
        type: "qc_remark_received",
        title: "QC remark received",
        body: args.message.slice(0, 120),
        relatedEntity: "survey",
        relatedId: args.surveyId,
      })
    }

    await writeAudit(ctx, {
      actorId: me._id,
      action: "qc.remark_added",
      entity: "survey",
      entityId: args.surveyId,
      metadata: { remarkId, taggedSections: args.taggedSections },
    })
    return remarkId
  },
})

export const resolveRemark = mutation({
  args: { id: v.id("qcRemarks") },
  handler: async (ctx, args) => {
    const [me, remark] = await Promise.all([requireUser(ctx), ctx.db.get(args.id)])
    if (!remark) clientError("NOT_FOUND", "Remark not found")
    await requireCapability(ctx, me, "qc.review")
    const survey = await ctx.db.get(remark.surveyId)
    if (!survey) clientError("NOT_FOUND", "Survey not found")
    if (me.role !== "admin") {
      await assertMunicipalityInScope(ctx, me, survey.municipalityId)
      assertCanReadWard(me, survey.municipalityId, survey.wardNo)
    }
    await ctx.db.patch(args.id, { status: "resolved" })
    await writeAudit(ctx, {
      actorId: me._id,
      action: "qc.remark_resolved",
      entity: "qcRemark",
      entityId: args.id,
      metadata: { surveyId: remark.surveyId },
    })
  },
})

/**
 * Supervisor decision — approve or reject. Cascades to survey:
 *  - approve → survey.qcStatus='approved', status='approved'
 *  - reject  → survey.qcStatus='rejected', status='draft' (surveyor can fix and resubmit)
 */
export const decide = mutation({
  args: {
    surveyId: v.id("surveys"),
    decision: v.union(v.literal("approve"), v.literal("reject")),
    comment: v.optional(v.string()),
    taggedSections: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const [me, survey] = await Promise.all([requireUser(ctx), ctx.db.get(args.surveyId)])
    await requireCapability(ctx, me, "qc.decide")
    if (!survey) clientError("NOT_FOUND", "Survey not found")
    if (me.role !== "admin") {
      await assertMunicipalityInScope(ctx, me, survey.municipalityId)
      assertCanReadWard(me, survey.municipalityId, survey.wardNo)
    }
    if (survey.status === "draft") {
      clientError("BAD_STATE", "Draft surveys cannot be reviewed")
    }

    const now = Date.now()
    await Promise.all([
      ctx.db.insert("qcDecisions", {
        surveyId: args.surveyId,
        reviewerId: me._id,
        decision: args.decision,
        comment: args.comment,
        taggedSections: args.taggedSections ?? [],
        decidedAt: now,
      }),
      ctx.db.patch(args.surveyId, {
        qcStatus: args.decision === "approve" ? "approved" : "rejected",
        status: args.decision === "approve" ? "approved" : "draft",
        serverVersion: survey.serverVersion + 1,
      }),
    ])

    const decided = await ctx.db.get(args.surveyId)
    if (decided) await recordSurveyStatsUpdate(ctx, survey, decided)

    if (args.comment && args.comment.trim().length > 0) {
      await ctx.db.insert("qcRemarks", {
        surveyId: args.surveyId,
        authorId: me._id,
        authorRole: me.role,
        message: args.comment.trim(),
        taggedSections: args.taggedSections ?? [],
        status: args.decision === "approve" ? "resolved" : "open",
      })
    }

    await ctx.db.insert("notifications", {
      userId: survey.surveyorId,
      type: args.decision === "approve" ? "qc_approved" : "qc_rejected",
      title: args.decision === "approve" ? "Survey approved" : "Survey returned for revision",
      body:
        args.comment?.slice(0, 120) ??
        (args.decision === "approve"
          ? "Your survey has been approved."
          : "Open the survey to see what needs revising."),
      relatedEntity: "survey",
      relatedId: args.surveyId,
    })

    await writeAudit(ctx, {
      actorId: me._id,
      action: `qc.${args.decision}`,
      entity: "survey",
      entityId: args.surveyId,
      metadata: { taggedSections: args.taggedSections, comment: args.comment },
    })
  },
})

/** Reopen an approved survey for further editing — admin or supervisor only. */
export const reopen = mutation({
  args: { surveyId: v.id("surveys"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const [me, survey] = await Promise.all([requireUser(ctx), ctx.db.get(args.surveyId)])
    await requireCapability(ctx, me, "qc.reopen")
    if (!survey) clientError("NOT_FOUND", "Survey not found")
    if (me.role !== "admin") {
      await assertMunicipalityInScope(ctx, me, survey.municipalityId)
      assertCanReadWard(me, survey.municipalityId, survey.wardNo)
    }
    if (survey.qcStatus !== "approved") {
      clientError("BAD_STATE", "Only approved surveys can be reopened")
    }
    await Promise.all([
      ctx.db.patch(args.surveyId, {
        qcStatus: "pending",
        status: "submitted",
        serverVersion: survey.serverVersion + 1,
      }),
      writeAudit(ctx, {
        actorId: me._id,
        action: "qc.reopened",
        entity: "survey",
        entityId: args.surveyId,
        metadata: { reason: args.reason },
      }),
    ])
    const reopened = await ctx.db.get(args.surveyId)
    if (reopened) await recordSurveyStatsUpdate(ctx, survey, reopened)
  },
})
