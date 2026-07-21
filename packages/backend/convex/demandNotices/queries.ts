import { v } from "convex/values"
import { query } from "../_generated/server"
import { MAX_DEMAND_NOTICE_PAYLOAD_PAGE } from "../lib/budgetLimits"
import { requireCapability } from "../shared/capabilities"
import { assertCanAccessSurvey } from "../shared/fieldAccess"
import { clientError, requireUser } from "../shared/helpers"
import { assertJobAccess, buildNoticePayloadsForSurveys, exportJobValidator } from "./helpers"

export const getExportJob = query({
  args: { jobId: v.id("demandNoticeExportJobs") },
  returns: exportJobValidator,
  handler: async (ctx, args) => {
    const [me, job] = await Promise.all([requireUser(ctx), ctx.db.get(args.jobId)])
    assertJobAccess(me, job)

    let downloadUrl: string | null = null
    if (job!.status === "completed" && job!.storageId) {
      downloadUrl = await ctx.storage.getUrl(job!.storageId)
    }

    return {
      _id: job!._id,
      status: job!.status,
      processedCount: job!.processedCount,
      totalCount: job!.totalCount,
      filename: job!.filename,
      errorMessage: job!.errorMessage ?? null,
      downloadUrl,
    }
  },
})

export const getNoticeForSurvey = query({
  args: {
    surveyId: v.id("surveys"),
    reportDateMs: v.number(),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const [me, survey] = await Promise.all([requireUser(ctx), ctx.db.get(args.surveyId)])
    if (!survey || survey.qcStatus !== "approved") return null
    await requireCapability(ctx, me, "reports.export")
    await assertCanAccessSurvey(ctx, me, survey)

    const payloads = await buildNoticePayloadsForSurveys(ctx, me, {
      surveyIds: [args.surveyId],
      municipalityId: survey.municipalityId,
      reportDateMs: args.reportDateMs,
    })

    return payloads[0] ?? null
  },
})

/**
 * Page of demand-notice document props for a bulk export job.
 * Clients must loop with offset until nextOffset is null — never request the full job in one call.
 */
export const getNoticePayloads = query({
  args: {
    jobId: v.id("demandNoticeExportJobs"),
    offset: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    payloads: v.array(v.any()),
    total: v.number(),
    offset: v.number(),
    nextOffset: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, args) => {
    const [me, job] = await Promise.all([requireUser(ctx), ctx.db.get(args.jobId)])
    assertJobAccess(me, job)

    const total = job!.surveyIds.length
    const offset = Math.max(args.offset ?? 0, 0)
    if (offset > total) {
      clientError("VALIDATION", "Demand notice payload offset is past the end of the job")
    }
    const limit = Math.min(
      Math.max(args.limit ?? MAX_DEMAND_NOTICE_PAYLOAD_PAGE, 1),
      MAX_DEMAND_NOTICE_PAYLOAD_PAGE,
    )
    const pageIds = job!.surveyIds.slice(offset, offset + limit)

    const payloads = await buildNoticePayloadsForSurveys(ctx, me, {
      surveyIds: pageIds,
      municipalityId: job!.municipalityId,
      reportDateMs: job!.reportDateMs,
    })

    const nextOffset = offset + limit < total ? offset + limit : null
    return { payloads, total, offset, nextOffset }
  },
})
