/**
 * Web-only dashboard queries — single-pass aggregates for the home screen.
 * Mobile does not call these; existing `masters.dashboardCounts` / `analytics.*`
 * endpoints remain unchanged for backward compatibility.
 */
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { hasCapability } from "./capabilities";
import { querySurveysInFieldScope } from "./fieldAccess";
import { requireUser } from "./helpers";
import {
  loadAnalyticsBreakdownFromStats,
  loadDashboardCountsForHome,
  loadDashboardDailyTrend,
} from "./lib/surveyScopeStats";
import {
  buildGroupSurveyCounts,
  computeWardCoverageFromSlice,
  countRowsFromSlice,
  type SurveyStatsSlice,
} from "./lib/surveyStatsAggregate";
import { qcStatus, surveyStatus } from "./schema";
import { resolveTenantScope, tenantDistrictIds, tenantMunicipalityIds } from "./tenancy";

const MS_PER_DAY = 86_400_000;
const DASHBOARD_QC_DECISIONS_PER_REVIEWER_CAP = 400;
const DASHBOARD_ANALYTICS_WINDOW_BUFFER_DAYS = 14;
const DASHBOARD_SURVEYOR_SLICE_LIMIT = 2000;

const surveyCountsShape = {
  total: v.number(),
  today: v.number(),
  drafts: v.number(),
  submitted: v.number(),
  approved: v.number(),
  rejected: v.number(),
};

const breakdownRow = { ...surveyCountsShape };

const dashboardCountsShape = {
  total: v.number(),
  today: v.number(),
  drafts: v.number(),
  pending: v.number(),
  submittedToday: v.number(),
  approved: v.number(),
  submitted: v.number(),
  rejected: v.number(),
};

const qcSupervisorRow = {
  reviewerId: v.id("users"),
  name: v.string(),
  email: v.string(),
  approved: v.number(),
  rejected: v.number(),
  total: v.number(),
};

const userFilterOption = v.object({
  _id: v.id("users"),
  name: v.string(),
  email: v.string(),
});

const statsBreakdownShape = v.object({
  summary: v.object(surveyCountsShape),
  byDistrict: v.array(
    v.object({
      districtId: v.id("districts"),
      code: v.string(),
      name: v.string(),
      ...breakdownRow,
    }),
  ),
  byUlb: v.array(
    v.object({
      municipalityId: v.id("municipalities"),
      code: v.string(),
      name: v.string(),
      districtId: v.id("districts"),
      districtName: v.string(),
      ...breakdownRow,
    }),
  ),
  bySurveyor: v.array(
    v.object({
      surveyorId: v.id("users"),
      name: v.string(),
      email: v.string(),
      municipalityName: v.union(v.string(), v.null()),
      districtName: v.union(v.string(), v.null()),
      status: v.literal("active"),
      ...breakdownRow,
    }),
  ),
  byQcSupervisor: v.array(v.object(qcSupervisorRow)),
  filterOptions: v.object({
    districts: v.array(
      v.object({
        _id: v.id("districts"),
        code: v.string(),
        name: v.string(),
      }),
    ),
    municipalities: v.array(
      v.object({
        _id: v.id("municipalities"),
        code: v.string(),
        name: v.string(),
        districtId: v.id("districts"),
      }),
    ),
    surveyors: v.array(userFilterOption),
    qcSupervisors: v.array(userFilterOption),
  }),
});

const dailyTrendPointShape = v.object({
  date: v.string(),
  created: v.number(),
  submitted: v.number(),
  approved: v.number(),
  rejected: v.number(),
});

const wardCoverageRowShape = v.object({
  municipalityId: v.id("municipalities"),
  municipalityName: v.string(),
  wardNo: v.string(),
  total: v.number(),
  approved: v.number(),
  approvalRate: v.number(),
});

const analyticsBundleShape = v.union(
  v.null(),
  v.object({
    breakdown: statsBreakdownShape,
    dailyTrend: v.array(dailyTrendPointShape),
    wardCoverage: v.array(wardCoverageRowShape),
  }),
);

const homeBundleShape = v.object({
  counts: v.object(dashboardCountsShape),
  analytics: analyticsBundleShape,
});

const EMPTY_COUNTS = {
  total: 0,
  today: 0,
  drafts: 0,
  pending: 0,
  submittedToday: 0,
  approved: 0,
  submitted: 0,
  rejected: 0,
};

type SurveyCounts = {
  total: number;
  today: number;
  drafts: number;
  submitted: number;
  approved: number;
  rejected: number;
};

function countRows(rows: SurveyStatsSlice[], todayStartMs: number | null): SurveyCounts {
  return countRowsFromSlice(rows, todayStartMs);
}

function groupCounts(
  rows: SurveyStatsSlice[],
  keyFn: (row: SurveyStatsSlice) => string,
  todayMs: number | null,
): Map<string, SurveyCounts> {
  return buildGroupSurveyCounts(rows, keyFn, todayMs);
}

function filterActiveUsersInScope(
  users: Doc<"users">[],
  muniIds: Set<Id<"municipalities">>,
  districtIds: Set<Id<"districts">>,
): Doc<"users">[] {
  return users.filter((u) => {
    if (u.municipalityId && !muniIds.has(u.municipalityId)) return false;
    if (u.districtId && !districtIds.has(u.districtId)) return false;
    return true;
  });
}

function startOfDayMs(nowMs: number): number {
  const d = new Date(nowMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Pick the cheaper QC decision load strategy based on scope size. */
async function loadScopedQcDecisionsByReviewer(
  ctx: QueryCtx,
  scopedSurveyIds: Set<Id<"surveys">>,
  activeQcSupervisors: Doc<"users">[],
  fromMs: number,
): Promise<Map<Id<"users">, Doc<"qcDecisions">[]>> {
  const byReviewer = new Map<Id<"users">, Doc<"qcDecisions">[]>();
  for (const u of activeQcSupervisors) {
    byReviewer.set(u._id, []);
  }

  if (scopedSurveyIds.size === 0 || activeQcSupervisors.length === 0) {
    return byReviewer;
  }

  // Query by reviewer in bounded windows to avoid per-survey fan-out reads.
  await Promise.all(
    activeQcSupervisors.map(async (reviewer) => {
      const decisions = await ctx.db
        .query("qcDecisions")
        .withIndex("by_reviewer", (q) => q.eq("reviewerId", reviewer._id))
        .order("desc")
        .take(DASHBOARD_QC_DECISIONS_PER_REVIEWER_CAP);
      for (const decision of decisions) {
        if (!scopedSurveyIds.has(decision.surveyId)) continue;
        if (decision._creationTime < fromMs) continue;
        const bucket = byReviewer.get(decision.reviewerId);
        if (bucket) bucket.push(decision);
      }
    }),
  );
  return byReviewer;
}

async function buildDashboardBreakdown(
  ctx: QueryCtx,
  me: Doc<"users">,
  statsBreakdown: Awaited<ReturnType<typeof loadAnalyticsBreakdownFromStats>>,
  surveyorRows: SurveyStatsSlice[],
  todayStartMs: number,
  fromMs: number,
  scope: Awaited<ReturnType<typeof resolveTenantScope>>,
) {
  const districtIds = tenantDistrictIds(scope);
  const muniIds = tenantMunicipalityIds(scope);
  const districtMap = new Map(scope.districts.map((d) => [d._id, d]));
  const muniMap = new Map(scope.municipalities.map((m) => [m._id, m]));

  const byDistrict =
    statsBreakdown?.byDistrict ??
    (() => {
      const byDistrictGroups = groupCounts(surveyorRows, (r) => r.districtId, todayStartMs);
      return [...byDistrictGroups.entries()]
        .map(([districtId, counts]) => {
          const d = districtMap.get(districtId as Id<"districts">);
          return {
            districtId: districtId as Id<"districts">,
            code: d?.code ?? "—",
            name: d?.name ?? "Unknown district",
            ...counts,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    })();

  const byUlb =
    statsBreakdown?.byUlb ??
    (() => {
      const byUlbGroups = groupCounts(surveyorRows, (r) => r.municipalityId, todayStartMs);
      return [...byUlbGroups.entries()]
        .map(([municipalityId, counts]) => {
          const m = muniMap.get(municipalityId as Id<"municipalities">);
          const d = m ? districtMap.get(m.districtId) : undefined;
          const sampleDistrictId = surveyorRows.find((r) => r.municipalityId === municipalityId)?.districtId;
          return {
            municipalityId: municipalityId as Id<"municipalities">,
            code: m?.code ?? "—",
            name: m?.name ?? "Unknown ULB",
            districtId: m?.districtId ?? sampleDistrictId ?? (municipalityId as Id<"districts">),
            districtName: d?.name ?? "—",
            ...counts,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    })();

  const bySurveyorGroups = groupCounts(surveyorRows, (r) => r.surveyorId, todayStartMs);

  const activeSurveyors = filterActiveUsersInScope(
    await ctx.db
      .query("users")
      .withIndex("by_role_status", (q) => q.eq("role", "surveyor").eq("status", "active"))
      .collect(),
    muniIds,
    districtIds,
  );

  const bySurveyor = activeSurveyors
    .map((u) => {
      const counts = bySurveyorGroups.get(u._id) ?? countRows([], todayStartMs);
      const muni = u.municipalityId ? muniMap.get(u.municipalityId) : undefined;
      const dist = u.districtId ? districtMap.get(u.districtId) : muni ? districtMap.get(muni.districtId) : undefined;
      return {
        surveyorId: u._id,
        name: u.name,
        email: u.email,
        municipalityName: muni?.name ?? null,
        districtName: dist?.name ?? null,
        status: "active" as const,
        ...counts,
      };
    })
    .sort((a, b) => b.approved + b.submitted - (a.approved + a.submitted));

  const activeQcSupervisors = filterActiveUsersInScope(
    await ctx.db
      .query("users")
      .withIndex("by_role_status", (q) => q.eq("role", "qc_supervisor").eq("status", "active"))
      .collect(),
    muniIds,
    districtIds,
  );

  const scopedSurveyIds = new Set(surveyorRows.map((r) => r._id));
  const decisionsByReviewer = await loadScopedQcDecisionsByReviewer(ctx, scopedSurveyIds, activeQcSupervisors, fromMs);

  const byQcSupervisor = activeQcSupervisors
    .map((u) => {
      const scoped = decisionsByReviewer.get(u._id) ?? [];
      let approved = 0;
      let rejected = 0;
      for (const decision of scoped) {
        if (decision.decision === "approve") approved += 1;
        if (decision.decision === "reject") rejected += 1;
      }
      return {
        reviewerId: u._id,
        name: u.name,
        email: u.email,
        approved,
        rejected,
        total: scoped.length,
      };
    })
    .sort((a, b) => b.total - a.total);

  return {
    summary: statsBreakdown?.summary ?? countRows(surveyorRows, todayStartMs),
    byDistrict,
    byUlb,
    bySurveyor,
    byQcSupervisor,
    filterOptions: {
      districts: scope.districts.map((d) => ({ _id: d._id, code: d.code, name: d.name })),
      municipalities: scope.municipalities.map((m) => ({
        _id: m._id,
        code: m.code,
        name: m.name,
        districtId: m.districtId,
      })),
      surveyors: activeSurveyors.map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
      })),
      qcSupervisors: activeQcSupervisors.map((u) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
      })),
    },
  };
}

function computeWardCoverage(rows: SurveyStatsSlice[], muniMap: Map<Id<"municipalities">, Doc<"municipalities">>) {
  const muniNames = new Map([...muniMap.entries()].map(([id, m]) => [id, m.name]));
  return computeWardCoverageFromSlice(rows, muniNames);
}

function toSurveyorSliceRows(rows: Doc<"surveys">[]): SurveyStatsSlice[] {
  return rows;
}

async function buildAnalyticsBundle(
  ctx: QueryCtx,
  me: Doc<"users">,
  todayMs: number,
  trendDays: number,
  nowMs: number,
) {
  const canViewAnalytics = await hasCapability(ctx, me, "analytics.view");
  if (!canViewAnalytics) return null;

  const days = Math.min(Math.max(trendDays, 1), 180);
  const analyticsFromMs = nowMs - (days + DASHBOARD_ANALYTICS_WINDOW_BUFFER_DAYS) * MS_PER_DAY;
  const scope = await resolveTenantScope(ctx, me);
  const muniMap = new Map(scope.municipalities.map((m) => [m._id, m]));

  const [statsBreakdown, surveyorSurveyRows] = await Promise.all([
    loadAnalyticsBreakdownFromStats(ctx, me, todayMs, scope),
    querySurveysInFieldScope(ctx, me, { limit: DASHBOARD_SURVEYOR_SLICE_LIMIT }),
  ]);
  const surveyorRows = toSurveyorSliceRows(surveyorSurveyRows);

  const [breakdown, dailyTrend, wardCoverage] = await Promise.all([
    buildDashboardBreakdown(ctx, me, statsBreakdown, surveyorRows, todayMs, analyticsFromMs, scope),
    loadDashboardDailyTrend(ctx, me, days, nowMs),
    Promise.resolve(computeWardCoverage(surveyorRows, muniMap)),
  ]);

  return { breakdown, dailyTrend, wardCoverage };
}

/** Accurate KPI counts for the web home dashboard (stats tables when backfilled). */
export const counts = query({
  args: { nowMs: v.number() },
  returns: v.object(dashboardCountsShape),
  handler: async (ctx, args) => {
    const me = await requireUser(ctx, { allowPending: true });
    if (me.status !== "active") return EMPTY_COUNTS;

    const todayMs = startOfDayMs(args.nowMs);
    return loadDashboardCountsForHome(ctx, me, todayMs);
  },
});

/** Charts and breakdown tables — capability-gated, separate subscription. */
export const analyticsBundle = query({
  args: {
    nowMs: v.number(),
    trendDays: v.optional(v.number()),
  },
  returns: analyticsBundleShape,
  handler: async (ctx, args) => {
    const me = await requireUser(ctx, { allowPending: true });
    if (me.status !== "active") return null;

    const todayMs = startOfDayMs(args.nowMs);
    return buildAnalyticsBundle(ctx, me, todayMs, args.trendDays ?? 30, args.nowMs);
  },
});

/**
 * Single-pass home dashboard bundle for the web app.
 * Loads scoped surveys once, then derives KPIs + analytics in memory.
 */
export const homeBundle = query({
  args: {
    nowMs: v.number(),
    trendDays: v.optional(v.number()),
  },
  returns: homeBundleShape,
  handler: async (ctx, args) => {
    const me = await requireUser(ctx, { allowPending: true });

    if (me.status !== "active") {
      return { counts: EMPTY_COUNTS, analytics: null };
    }

    const todayMs = startOfDayMs(args.nowMs);
    const trendDays = args.trendDays ?? 30;
    const counts = await loadDashboardCountsForHome(ctx, me, todayMs);
    const analytics = await buildAnalyticsBundle(ctx, me, todayMs, trendDays, args.nowMs);

    return { counts, analytics };
  },
});

const recentActivityRowShape = v.object({
  _id: v.id("surveys"),
  propertyId: v.optional(v.string()),
  parcelNo: v.optional(v.string()),
  status: surveyStatus,
  qcStatus: qcStatus,
  _creationTime: v.number(),
  submittedAt: v.optional(v.number()),
  surveyor: v.optional(v.object({ name: v.optional(v.string()) })),
});

/** Lightweight recent surveys for the home activity feed (web only). */
export const recentActivity = query({
  args: {},
  returns: v.array(recentActivityRowShape),
  handler: async (ctx) => {
    const me = await requireUser(ctx, { allowPending: true });
    if (me.status !== "active") return [];

    const rows = await querySurveysInFieldScope(ctx, me, { limit: 20 });
    const surveyorIds = [...new Set(rows.map((r) => r.surveyorId))];
    const surveyors = await Promise.all(surveyorIds.map((id) => ctx.db.get("users", id)));
    const nameById = new Map<Id<"users">, string>();
    for (const s of surveyors) {
      if (s) nameById.set(s._id, s.name);
    }

    return rows.map((r) => ({
      _id: r._id,
      propertyId: r.propertyId,
      parcelNo: r.parcelNo,
      status: r.status,
      qcStatus: r.qcStatus,
      _creationTime: r._creationTime,
      submittedAt: r.submittedAt,
      surveyor: { name: nameById.get(r.surveyorId) },
    }));
  },
});
