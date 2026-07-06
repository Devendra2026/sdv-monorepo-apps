/**
 * analyticsTrends.ts — time-series + coverage aggregates for the web dashboard.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 * ─────────────────────────────────────────────────────────────────────────
 * `analytics.surveyStatsBreakdown` already returns summary KPIs and the
 * by-district / by-ULB / by-surveyor breakdown tables — the web reuses those
 * directly. What it does NOT return is:
 *
 *   • a per-DAY series (the brief's "Daily Survey Trend" / "Approval Trend"), or
 *   • a per-WARD coverage roll-up (the brief's "Ward Coverage").
 *
 * Deriving these on the client would require pulling every raw survey row,
 * which `surveys.list` caps at 200 — so the numbers would silently undercount.
 * The correct, faithful fix is a server query that aggregates inside the same
 * tenant scope. This module ADDS read-only queries; it changes no schema,
 * writes nothing, and reuses the exact tenancy helpers the mobile app uses.
 */
import { v } from "convex/values"
import { query } from "./_generated/server"
import { requireCapability } from "./capabilities"
import { requireUser } from "./helpers"
import { loadBoundedScopedSurveyRows, loadDashboardDailyTrend } from "./lib/surveyScopeStats"
import { computeDailyTrendFromSlice, computeWardCoverageFromSlice } from "./lib/surveyStatsAggregate"
import { resolveTenantScope } from "./tenancy"

/**
 * Daily survey + approval trend over the last `days` days (default 30),
 * scoped to the caller. Returns a dense series (zero-filled) so charts
 * don't show gaps.
 */
export const dailyTrend = query({
  args: {
    days: v.optional(v.number()),
    districtId: v.optional(v.id("districts")),
    municipalityId: v.optional(v.id("municipalities")),
    nowMs: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      date: v.string(),
      created: v.number(),
      submitted: v.number(),
      approved: v.number(),
      rejected: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    await requireCapability(ctx, me, "analytics.view")
    const days = Math.min(Math.max(args.days ?? 30, 1), 180)

    if (args.nowMs === undefined) {
      return []
    }

    if (!args.districtId && !args.municipalityId) {
      return loadDashboardDailyTrend(ctx, me, days, args.nowMs)
    }

    let rows = await loadBoundedScopedSurveyRows(ctx, me)
    if (args.districtId) rows = rows.filter((r) => r.districtId === args.districtId)
    if (args.municipalityId) rows = rows.filter((r) => r.municipalityId === args.municipalityId)

    return computeDailyTrendFromSlice(rows, days, args.nowMs)
  },
})

/** Per-ward coverage roll-up within tenant scope (brief's "Ward Coverage"). */
export const wardCoverage = query({
  args: {
    districtId: v.optional(v.id("districts")),
    municipalityId: v.optional(v.id("municipalities")),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    await requireCapability(ctx, me, "analytics.view")

    let rows = await loadBoundedScopedSurveyRows(ctx, me)
    if (args.districtId) rows = rows.filter((r) => r.districtId === args.districtId)
    if (args.municipalityId) rows = rows.filter((r) => r.municipalityId === args.municipalityId)

    const scope = await resolveTenantScope(ctx, me)
    const muniNames = new Map(scope.municipalities.map((m) => [m._id, m.name]))

    return computeWardCoverageFromSlice(rows, muniNames)
  },
})
