import type { Id, TableNames } from "@workspace/backend/convex/_generated/dataModel.js"
import { z } from "zod"

const convexId = <T extends TableNames>() => z.custom<Id<T>>((value) => typeof value === "string")

/**
 * Analytics survey counts.
 */

export const surveyCountsSchema = z.object({
  total: z.number(),
  today: z.number(),
  drafts: z.number(),
  submitted: z.number(),
  approved: z.number(),
  rejected: z.number(),
})

export type SurveyCounts = z.infer<typeof surveyCountsSchema>

/**
 * Home dashboard KPI row from masters.dashboardCounts.
 */

export const dashboardCountsSchema = z.object({
  total: z.number(),
  today: z.number(),
  drafts: z.number(),
  pending: z.number(),
  submittedToday: z.number(),
  approved: z.number(),
  submitted: z.number(),
  rejected: z.number(),
})

export type DashboardCounts = z.infer<typeof dashboardCountsSchema>

/**
 * District analytics breakdown.
 */
export const districtBreakdownSchema = surveyCountsSchema.extend({
  districtId: convexId<"districts">(),
  code: z.string(),
  name: z.string(),
})

export type DistrictBreakdown = z.infer<typeof districtBreakdownSchema>

/**
 * Municipality / ULB analytics breakdown.
 */
export const ulbBreakdownSchema = surveyCountsSchema.extend({
  municipalityId: convexId<"municipalities">(),

  code: z.string(),

  name: z.string(),

  districtId: convexId<"districts">(),

  districtName: z.string(),
})

/**
 * Surveyor analytics breakdown.
 */
export const surveyorBreakdownSchema = surveyCountsSchema.extend({
  surveyorId: convexId<"users">(),

  name: z.string(),

  email: z.string().email(),

  municipalityName: z.string().nullable(),

  districtName: z.string().nullable(),

  status: z.literal("active"),
})

export type SurveyorBreakdown = z.infer<typeof surveyorBreakdownSchema>

/**
 * QC supervisor analytics breakdown.
 */
export const qcSupervisorBreakdownSchema = z.object({
  reviewerId: convexId<"users">(),

  name: z.string(),

  email: z.string().email(),

  approved: z.number(),

  rejected: z.number(),

  total: z.number(),
})

export type QcSupervisorBreakdown = z.infer<typeof qcSupervisorBreakdownSchema>

/**
 * Analytics filter options.
 */
export const districtFilterOptionSchema = z.object({
  _id: convexId<"districts">(),
  code: z.string(),
  name: z.string(),
})

export const municipalityFilterOptionSchema = z.object({
  _id: convexId<"municipalities">(),
  code: z.string(),
  name: z.string(),
  districtId: convexId<"districts">(),
})

export const userFilterOptionSchema = z.object({
  _id: convexId<"users">(),
  name: z.string(),
  email: z.string().email(),
})

/**
 * Complete analytics stats breakdown.
 */
export const statsBreakdownSchema = z.object({
  summary: surveyCountsSchema,

  byDistrict: z.array(districtBreakdownSchema),

  byUlb: z.array(ulbBreakdownSchema),

  bySurveyor: z.array(surveyorBreakdownSchema),

  byQcSupervisor: z.array(qcSupervisorBreakdownSchema),

  filterOptions: z.object({
    districts: z.array(districtFilterOptionSchema),

    municipalities: z.array(municipalityFilterOptionSchema),

    surveyors: z.array(userFilterOptionSchema),

    qcSupervisors: z.array(userFilterOptionSchema),
  }),
})

export type StatsBreakdown = z.infer<typeof statsBreakdownSchema>

/**
 * Daily analytics trend point.
 */
export const dailyTrendPointSchema = z.object({
  date: z.string(),

  created: z.number(),

  submitted: z.number(),

  approved: z.number(),

  rejected: z.number(),
})

export type DailyTrendPoint = z.infer<typeof dailyTrendPointSchema>

/**
 * Ward coverage analytics row.
 */
export const wardCoverageRowSchema = z.object({
  municipalityId: convexId<"municipalities">(),

  municipalityName: z.string(),

  wardNo: z.string(),

  total: z.number(),

  approved: z.number(),

  approvalRate: z.number(),
})

export type WardCoverageRow = z.infer<typeof wardCoverageRowSchema>

/**
 * Combined dashboard analytics.
 */
export const webDashboardAnalyticsSchema = z.object({
  breakdown: statsBreakdownSchema,

  dailyTrend: z.array(dailyTrendPointSchema),

  wardCoverage: z.array(wardCoverageRowSchema),
})

export type WebDashboardAnalytics = z.infer<typeof webDashboardAnalyticsSchema>

/**
 * Complete web dashboard bundle.
 */
export const webDashboardBundleSchema = z.object({
  counts: dashboardCountsSchema,

  analytics: webDashboardAnalyticsSchema.nullable(),
})

export type WebDashboardBundle = z.infer<typeof webDashboardBundleSchema>
