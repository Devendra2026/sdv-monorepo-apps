import { v } from "convex/values"
import { mutation } from "../_generated/server"
import { buildBulkDemandNoticeFilename } from "../lib/reports/demandNoticeFilename"
import { compareWardThenParcel } from "../lib/propertyId"
import { requireCapability } from "../shared/capabilities"
import { fieldSurveyAccess } from "../shared/fieldAccess"
import { clientError, requireUser } from "../shared/helpers"
import { assertMunicipalityInScope, resolveTenantScope, tenantMunicipalityIds } from "../shared/tenancy"
import { collectSurveysForListPaginated } from "../surveys/helpers"
import { assertJobAccess, MAX_EXPORT_SURVEYS } from "./helpers"

export const startBulkExport = mutation({
  args: {
    municipalityId: v.id("municipalities"),
    districtId: v.optional(v.id("districts")),
    wardNo: v.optional(v.string()),
    reportDateMs: v.number(),
  },
  returns: v.id("demandNoticeExportJobs"),
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    await requireCapability(ctx, me, "reports.export")
    await assertMunicipalityInScope(ctx, me, args.municipalityId)

    const scope = await resolveTenantScope(ctx, me)
    const muniIds = tenantMunicipalityIds(scope)
    const access = await fieldSurveyAccess(ctx, me)

    const filtered = await collectSurveysForListPaginated(
      ctx,
      me,
      {
        qcStatus: "approved",
        municipalityId: args.municipalityId,
        districtId: args.districtId,
        wardNo: args.wardNo,
      },
      scope,
      muniIds,
      access,
      MAX_EXPORT_SURVEYS + 1,
    )

    if (filtered.length === 0) {
      clientError("VALIDATION", "No QC-approved properties found for this scope")
    }
    if (filtered.length > MAX_EXPORT_SURVEYS) {
      clientError("VALIDATION", `Export is limited to ${MAX_EXPORT_SURVEYS} properties per run`)
    }

    const sorted = filtered.toSorted(compareWardThenParcel)
    const surveyIds = sorted.map((row) => row._id)

    const muni = await ctx.db.get(args.municipalityId)
    const filename = buildBulkDemandNoticeFilename({
      ulbName: muni?.name,
      wardNo: args.wardNo,
    })

    const jobId = await ctx.db.insert("demandNoticeExportJobs", {
      requestedBy: me._id,
      municipalityId: args.municipalityId,
      districtId: args.districtId,
      wardNo: args.wardNo,
      status: "queued",
      surveyIds,
      processedCount: 0,
      totalCount: surveyIds.length,
      filename,
      reportDateMs: args.reportDateMs,
      createdAt: Date.now(),
    })

    await ctx.db.patch(jobId, { status: "rendering" })
    return jobId
  },
})

export const updateExportProgress = mutation({
  args: {
    jobId: v.id("demandNoticeExportJobs"),
    processedCount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [me, job] = await Promise.all([requireUser(ctx), ctx.db.get(args.jobId)])
    assertJobAccess(me, job)

    await ctx.db.patch(args.jobId, {
      processedCount: Math.min(args.processedCount, job!.totalCount),
      status: "rendering",
    })
    return null
  },
})

export const generateUploadUrl = mutation({
  args: { jobId: v.id("demandNoticeExportJobs") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const [me, job] = await Promise.all([requireUser(ctx), ctx.db.get(args.jobId)])
    assertJobAccess(me, job)
    const [, uploadUrl] = await Promise.all([
      ctx.db.patch(args.jobId, { status: "uploading" }),
      ctx.storage.generateUploadUrl(),
    ])
    return uploadUrl
  },
})

export const completeExport = mutation({
  args: {
    jobId: v.id("demandNoticeExportJobs"),
    storageId: v.id("_storage"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [me, job] = await Promise.all([requireUser(ctx), ctx.db.get(args.jobId)])
    assertJobAccess(me, job)

    // Replace previous blob if a retry completed with a new upload.
    if (job!.storageId && job!.storageId !== args.storageId) {
      try {
        await ctx.storage.delete(job!.storageId)
      } catch {
        // blob may already be gone
      }
    }

    await ctx.db.patch(args.jobId, {
      status: "completed",
      storageId: args.storageId,
      processedCount: job!.totalCount,
      completedAt: Date.now(),
    })
    return null
  },
})

export const failExport = mutation({
  args: {
    jobId: v.id("demandNoticeExportJobs"),
    errorMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [me, job] = await Promise.all([requireUser(ctx), ctx.db.get(args.jobId)])
    assertJobAccess(me, job)

    await ctx.db.patch(args.jobId, {
      status: "failed",
      errorMessage: args.errorMessage,
      completedAt: Date.now(),
    })
    return null
  },
})
