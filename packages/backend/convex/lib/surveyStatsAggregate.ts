import type { Doc, Id } from "../_generated/dataModel";

/** Fields needed for dashboard KPI and breakdown aggregation. */
export type SurveyStatsSlice = Pick<
  Doc<"surveys">,
  | "_id"
  | "status"
  | "qcStatus"
  | "districtId"
  | "municipalityId"
  | "wardNo"
  | "surveyorId"
  | "submittedAt"
  | "_creationTime"
  | "city"
>;

export type SurveyCounts = {
  total: number;
  today: number;
  drafts: number;
  submitted: number;
  approved: number;
  rejected: number;
};

export type DashboardCounts = SurveyCounts & {
  pending: number;
  submittedToday: number;
};

type MutableSurveyCounts = {
  total: number;
  today: number;
  drafts: number;
  submitted: number;
  approved: number;
  rejected: number;
};

type MutableDashboardCounts = MutableSurveyCounts & {
  pending: number;
  submittedToday: number;
};

function emptySurveyCounts(): MutableSurveyCounts {
  return { total: 0, today: 0, drafts: 0, submitted: 0, approved: 0, rejected: 0 };
}

function emptyDashboardCounts(): MutableDashboardCounts {
  return { ...emptySurveyCounts(), pending: 0, submittedToday: 0 };
}

function addRowToSurveyCounts(bucket: MutableSurveyCounts, row: SurveyStatsSlice, todayMs: number | null) {
  bucket.total += 1;
  if (todayMs !== null && row._creationTime >= todayMs) bucket.today += 1;
  if (row.status === "draft") bucket.drafts += 1;
  if (row.status === "submitted") bucket.submitted += 1;
  if (row.qcStatus === "approved") bucket.approved += 1;
  if (row.qcStatus === "rejected") bucket.rejected += 1;
}

function addRowToDashboardCounts(bucket: MutableDashboardCounts, row: SurveyStatsSlice, todayMs: number | null) {
  addRowToSurveyCounts(bucket, row, todayMs);
  if (row.qcStatus === "pending" && row.status === "submitted") bucket.pending += 1;
  if (todayMs !== null && row.status !== "draft") {
    const submittedTs = row.submittedAt ?? row._creationTime;
    if (submittedTs >= todayMs) bucket.submittedToday += 1;
  }
}

export function countRowsFromSlice(rows: SurveyStatsSlice[], todayStartMs: number | null): SurveyCounts {
  const bucket = emptySurveyCounts();
  for (const row of rows) addRowToSurveyCounts(bucket, row, todayStartMs);
  return bucket;
}

export function computeDashboardCountsFromSlice(rows: SurveyStatsSlice[], todayMs: number | null): DashboardCounts {
  const bucket = emptyDashboardCounts();
  for (const row of rows) addRowToDashboardCounts(bucket, row, todayMs);
  return bucket;
}

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type TrendBucket = { created: number; submitted: number; approved: number; rejected: number };

export function computeDailyTrendFromSlice(rows: SurveyStatsSlice[], days: number, nowMs: number) {
  const start = new Date(nowMs);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  const startMs = start.getTime();

  const buckets = new Map<string, TrendBucket>();
  for (let i = 0; i < days; i++) {
    const d = new Date(startMs);
    d.setDate(d.getDate() + i);
    buckets.set(dayKey(d.getTime()), { created: 0, submitted: 0, approved: 0, rejected: 0 });
  }

  for (const r of rows) {
    if (r._creationTime >= startMs) {
      const b = buckets.get(dayKey(r._creationTime));
      if (b) b.created += 1;
    }
    if (r.submittedAt && r.submittedAt >= startMs) {
      const b = buckets.get(dayKey(r.submittedAt));
      if (b) {
        b.submitted += 1;
        if (r.qcStatus === "approved") b.approved += 1;
        else if (r.qcStatus === "rejected") b.rejected += 1;
      }
    }
  }

  return [...buckets.entries()].map(([date, b]) => ({ date, ...b }));
}

export function computeWardCoverageFromSlice(rows: SurveyStatsSlice[], muniNames: Map<Id<"municipalities">, string>) {
  const groups = new Map<
    string,
    { municipalityId: Id<"municipalities">; wardNo: string; total: number; approved: number }
  >();
  for (const r of rows) {
    const key = `${r.municipalityId}::${r.wardNo}`;
    const g = groups.get(key) ?? { municipalityId: r.municipalityId, wardNo: r.wardNo, total: 0, approved: 0 };
    g.total += 1;
    if (r.qcStatus === "approved") g.approved += 1;
    groups.set(key, g);
  }

  return [...groups.values()]
    .map((g) => ({
      ...g,
      municipalityName: muniNames.get(g.municipalityId) ?? "—",
      approvalRate: g.total > 0 ? Math.round((g.approved / g.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

/** Group-keyed survey counts built in a single pass over rows. */
export function buildGroupSurveyCounts(
  rows: SurveyStatsSlice[],
  keyFn: (row: SurveyStatsSlice) => string,
  todayMs: number | null,
): Map<string, SurveyCounts> {
  const groups = new Map<string, MutableSurveyCounts>();
  for (const row of rows) {
    const key = keyFn(row);
    const bucket = groups.get(key) ?? emptySurveyCounts();
    addRowToSurveyCounts(bucket, row, todayMs);
    groups.set(key, bucket);
  }
  return groups;
}
