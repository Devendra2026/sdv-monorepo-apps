/**
 * QC workflow queries.
 */
import { v } from "convex/values"
import type { Doc } from "../_generated/dataModel"
import { query } from "../_generated/server"
import { normalizeParcelKey, resolvePropertyId } from "../lib/propertyId"
import { computeQcWardAggregates } from "../lib/qcWardStats"
import { loadWardStatsForScope } from "../lib/surveyRollupStats"
import { loadScopeStatsSummary } from "../lib/surveyScopeStats"
import { requireCapability } from "../shared/capabilities"
import { assertCanAccessSurvey, fieldSurveyAccess } from "../shared/fieldAccess"
import { assertCanReadWard, clientError, mapTruthyById, requireUser } from "../shared/helpers"
import {
  assertMunicipalityInScope,
  resolveTenantScope,
  tenantDistrictIds,
  tenantMunicipalityIds,
} from "../shared/tenancy"
import { collectSurveysForListPaginated, COMMAND_CENTER_WARD_SCAN_LIMIT } from "../surveys/helpers"
import {
  commandCenterStatsShape,
  MAX_PARCEL_SIBLING_RESULTS,
  parcelSiblingEntry,
  qcRemarkWithAuthorShape,
  wardNumbersMatch,
} from "./helpers"

/** Scoped KPI counts for the QC command center — full dataset, not client-capped. */
export const commandCenterStats = query({
  args: {
    districtId: v.optional(v.id("districts")),
    municipalityId: v.optional(v.id("municipalities")),
    wardNo: v.optional(v.string()),
    fromMs: v.optional(v.number()),
    toMs: v.optional(v.number()),
    nowMs: v.number(),
  },
  returns: v.object(commandCenterStatsShape),
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    await requireCapability(ctx, me, "qc.review")

    const scope = await resolveTenantScope(ctx, me)
    const districtIds = tenantDistrictIds(scope)
    const muniIds = tenantMunicipalityIds(scope)
    const access = await fieldSurveyAccess(ctx, me)

    if (args.municipalityId) {
      await assertMunicipalityInScope(ctx, me, args.municipalityId)
    }
    if (args.districtId && access !== "admin" && !districtIds.has(args.districtId)) {
      clientError("FORBIDDEN", "This district is outside your assigned scope")
    }

    const todayMs = (() => {
      const d = new Date(args.nowMs)
      d.setHours(0, 0, 0, 0)
      return d.getTime()
    })()

    const useStatsFastPath = !args.wardNo && args.fromMs === undefined && args.toMs === undefined
    const useWardRollup = args.fromMs === undefined && args.toMs === undefined

    const wardStatsFromRollup = useWardRollup
      ? (
          await loadWardStatsForScope(ctx, me, {
            districtId: args.districtId,
            municipalityId: args.municipalityId,
            wardNo: args.wardNo,
          })
        ).map((w) => {
          const decided = w.qcPending + w.qcApproved + w.qcRejected
          return {
            wardNo: w.wardNo,
            municipalityId: w.municipalityId,
            city: w.city,
            pending: w.qcPending,
            approved: w.qcApproved,
            rejected: w.qcRejected,
            drafts: w.drafts,
            total: w.total,
            qcCompletionPct: decided > 0 ? Math.round((w.qcApproved / decided) * 100) : 0,
            firstPendingId: w.firstPendingSurveyId,
          }
        })
      : null

    if (useStatsFastPath) {
      const summary = await loadScopeStatsSummary(ctx, me, todayMs, {
        districtId: args.districtId,
        municipalityId: args.municipalityId,
      })
      if (summary && wardStatsFromRollup) {
        const decided = summary.qcPending + summary.qcApproved + summary.qcRejected
        return {
          pending: summary.qcPending,
          approved: summary.qcApproved,
          rejected: summary.qcRejected,
          drafts: summary.drafts,
          submittedToday: summary.submittedToday,
          submitted: summary.submitted,
          qcCompletionPct: decided > 0 ? Math.round((summary.qcApproved / decided) * 100) : 0,
          wardStats: wardStatsFromRollup,
        }
      }
    }

    const rows = await collectSurveysForListPaginated(
      ctx,
      me,
      {
        districtId: args.districtId,
        municipalityId: args.municipalityId,
        wardNo: args.wardNo,
      },
      scope,
      muniIds,
      access,
      COMMAND_CENTER_WARD_SCAN_LIMIT
    )

    const inDateRange = (submittedAt: number | undefined, creationTime: number) => {
      const ts = submittedAt ?? creationTime
      if (args.fromMs !== undefined && ts < args.fromMs) return false
      if (args.toMs !== undefined && ts > args.toMs) return false
      return true
    }

    const filtered = rows.filter((r) => inDateRange(r.submittedAt, r._creationTime))
    const resolvedWardStats = wardStatsFromRollup ?? computeQcWardAggregates(filtered)

    if (useStatsFastPath) {
      const summary = await loadScopeStatsSummary(ctx, me, todayMs, {
        districtId: args.districtId,
        municipalityId: args.municipalityId,
      })
      if (summary) {
        const decided = summary.qcPending + summary.qcApproved + summary.qcRejected
        return {
          pending: summary.qcPending,
          approved: summary.qcApproved,
          rejected: summary.qcRejected,
          drafts: summary.drafts,
          submittedToday: summary.submittedToday,
          submitted: summary.submitted,
          qcCompletionPct: decided > 0 ? Math.round((summary.qcApproved / decided) * 100) : 0,
          wardStats: resolvedWardStats,
        }
      }
    }

    const pending = filtered.filter((r) => r.qcStatus === "pending" && r.status === "submitted").length
    const approved = filtered.filter((r) => r.qcStatus === "approved").length
    const rejected = filtered.filter((r) => r.qcStatus === "rejected").length
    const decided = pending + approved + rejected
    const qcCompletionPct = decided > 0 ? Math.round((approved / decided) * 100) : 0

    return {
      pending,
      approved,
      rejected,
      drafts: filtered.filter((r) => r.status === "draft").length,
      submittedToday: filtered.filter(
        (r) =>
          r.status === "submitted" &&
          (r.submittedAt !== undefined ? r.submittedAt >= todayMs : r._creationTime >= todayMs)
      ).length,
      submitted: filtered.filter((r) => r.status === "submitted").length,
      qcCompletionPct,
      wardStats: resolvedWardStats,
    }
  },
})

/** Other surveys on the same ward + parcel as the given record (QC review context). */
export const listParcelSiblings = query({
  args: { surveyId: v.id("surveys") },
  returns: v.array(parcelSiblingEntry),
  handler: async (ctx, args) => {
    const [me, survey] = await Promise.all([requireUser(ctx), ctx.db.get(args.surveyId)])
    await requireCapability(ctx, me, "qc.review")
    if (!survey) return []

    await assertMunicipalityInScope(ctx, me, survey.municipalityId)
    assertCanReadWard(me, survey.municipalityId, survey.wardNo)

    const parcelKey = normalizeParcelKey(survey.parcelNo)
    const wardVariants = new Set([survey.wardNo.trim()])
    const wardNum = Number(survey.wardNo)
    if (!Number.isNaN(wardNum)) {
      wardVariants.add(String(wardNum))
      wardVariants.add(String(wardNum).padStart(2, "0"))
    }

    // Before: unbounded `.collect()` per ward string variant (timeout on dense wards).
    // After: O(variants × cap) indexed take — enough to find parcel siblings.
    const WARD_SIBLING_SCAN_CAP = 500
    const wardRows: Doc<"surveys">[] = []
    const batches = await Promise.all(
      [...wardVariants].map((ward) =>
        ctx.db
          .query("surveys")
          .withIndex("by_municipality_ward", (q) => q.eq("municipalityId", survey.municipalityId).eq("wardNo", ward))
          .take(WARD_SIBLING_SCAN_CAP)
      )
    )
    for (const batch of batches) {
      for (const row of batch) {
        if (!wardRows.some((existing) => existing._id === row._id)) wardRows.push(row)
      }
    }

    const siblings = wardRows.filter(
      (row) =>
        row._id !== args.surveyId &&
        wardNumbersMatch(row.wardNo, survey.wardNo) &&
        normalizeParcelKey(row.parcelNo) === parcelKey
    )

    const surveyorIds = Array.from(new Set(siblings.map((s) => s.surveyorId)))
    const surveyors = await Promise.all(surveyorIds.map((id) => ctx.db.get(id)))
    const surveyorById = mapTruthyById(surveyors)

    return siblings.slice(0, MAX_PARCEL_SIBLING_RESULTS).map((row) => ({
      _id: row._id,
      propertyId: row.propertyId,
      propertyUse: row.propertyUse,
      unitNo: row.unitNo,
      wardNo: row.wardNo,
      parcelNo: row.parcelNo,
      respondentName: row.respondentName,
      qcStatus: row.qcStatus,
      status: row.status,
      surveyorName: surveyorById.get(row.surveyorId)?.name,
    }))
  },
})

/** Other surveys sharing the same resolved Property ID (blocks QC save until resolved). */
export const listPropertyIdConflicts = query({
  args: { surveyId: v.id("surveys") },
  returns: v.array(parcelSiblingEntry),
  handler: async (ctx, args) => {
    const [me, survey] = await Promise.all([requireUser(ctx), ctx.db.get(args.surveyId)])
    await requireCapability(ctx, me, "qc.review")
    if (!survey) return []

    await assertMunicipalityInScope(ctx, me, survey.municipalityId)
    assertCanReadWard(me, survey.municipalityId, survey.wardNo)

    const muni = await ctx.db.get(survey.municipalityId)
    const resolvedId = resolvePropertyId(survey, muni?.code ?? "")
    if (!resolvedId) return []

    const matches = await ctx.db
      .query("surveys")
      .withIndex("by_property_id", (q) => q.eq("propertyId", resolvedId))
      .take(MAX_PARCEL_SIBLING_RESULTS + 50)

    const conflicts = matches.filter((row) => {
      if (row._id === args.surveyId) return false
      if (row.municipalityId !== survey.municipalityId) return false
      try {
        assertCanReadWard(me, row.municipalityId, row.wardNo)
        return true
      } catch {
        return false
      }
    })
    if (conflicts.length === 0) return []

    const surveyorIds = Array.from(new Set(conflicts.map((s) => s.surveyorId)))
    const surveyors = await Promise.all(surveyorIds.map((id) => ctx.db.get(id)))
    const surveyorById = mapTruthyById(surveyors)

    return conflicts.map((row) => ({
      _id: row._id,
      propertyId: row.propertyId,
      propertyUse: row.propertyUse,
      unitNo: row.unitNo,
      wardNo: row.wardNo,
      parcelNo: row.parcelNo,
      respondentName: row.respondentName,
      qcStatus: row.qcStatus,
      status: row.status,
      surveyorName: surveyorById.get(row.surveyorId)?.name,
    }))
  },
})

export const listRemarks = query({
  args: { surveyId: v.id("surveys") },
  returns: v.array(v.object(qcRemarkWithAuthorShape)),
  handler: async (ctx, args) => {
    const [me, survey] = await Promise.all([requireUser(ctx), ctx.db.get(args.surveyId)])
    if (!survey) return []
    await assertCanAccessSurvey(ctx, me, survey)

    const rows = await ctx.db
      .query("qcRemarks")
      .withIndex("by_survey", (q) => q.eq("surveyId", args.surveyId))
      .order("desc")
      .collect()

    const authorIds = Array.from(new Set(rows.map((r) => r.authorId)))
    const authors = await Promise.all(authorIds.map((id) => ctx.db.get(id)))
    const byId = mapTruthyById(authors)

    return rows.map((r) => ({
      ...r,
      author: byId.get(r.authorId)
        ? { _id: r.authorId, name: byId.get(r.authorId)!.name, role: byId.get(r.authorId)!.role }
        : null,
    }))
  },
})
