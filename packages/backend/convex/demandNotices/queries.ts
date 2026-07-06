import { v } from "convex/values"
import { query } from "../_generated/server"
import { assertCanAccessSurvey } from "../shared/fieldAccess"
import { requireUser } from "../shared/helpers"
import { requireCapability } from "../shared/capabilities"
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
    reportDateMs: v.optional(v.number()),
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
      reportDateMs: args.reportDateMs ?? Date.now(),
    })

    return payloads[0] ?? null
  },
})

export const getNoticePayloads = query({
  args: { jobId: v.id("demandNoticeExportJobs") },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const [me, job] = await Promise.all([requireUser(ctx), ctx.db.get(args.jobId)])
    assertJobAccess(me, job)

    return await buildNoticePayloadsForSurveys(ctx, me, {
      surveyIds: job!.surveyIds,
      municipalityId: job!.municipalityId,
      reportDateMs: job!.reportDateMs,
    })
  },
})
