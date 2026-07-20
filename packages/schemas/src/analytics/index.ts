import { z } from "zod"

const convexIdSchema = <T extends string>() => z.string() as unknown as z.ZodType<string & { __tableName: T }>

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
  districtId: convexIdSchema<"districts">(),
  code: z.string(),
  name: z.string(),
})

export type DistrictBreakdown = z.infer<typeof districtBreakdownSchema>

/**
 * Municipality / ULB analytics breakdown.
 */
export const ulbBreakdownSchema = surveyCountsSchema.extend({
  municipalityId: convexIdSchema<"municipalities">(),

  code: z.string(),

  name: z.string(),

  districtId: convexIdSchema<"districts">(),

  districtName: z.string(),
})

/**
 * Surveyor analytics breakdown.
 */
export const surveyorBreakdownSchema = surveyCountsSchema.extend({
  surveyorId: convexIdSchema<"users">(),

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
  reviewerId: convexIdSchema<"users">(),

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
  _id: convexIdSchema<"districts">(),
  code: z.string(),
  name: z.string(),
})

export const municipalityFilterOptionSchema = z.object({
  _id: convexIdSchema<"municipalities">(),
  code: z.string(),
  name: z.string(),
  districtId: convexIdSchema<"districts">(),
})

export const userFilterOptionSchema = z.object({
  _id: convexIdSchema<"users">(),
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
  municipalityId: convexIdSchema<"municipalities">(),

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
 * QC supervisor sibling bundle for the home dashboard (loaded separately from analyticsBundle).
 */
export const webDashboardQcSupervisorsSchema = z.object({
  byQcSupervisor: z.array(qcSupervisorBreakdownSchema),
  qcSupervisors: z.array(userFilterOptionSchema),
})

export type WebDashboardQcSupervisors = z.infer<typeof webDashboardQcSupervisorsSchema>

/**
 * Complete web dashboard bundle.
 */
export const webDashboardBundleSchema = z.object({
  counts: dashboardCountsSchema,

  analytics: webDashboardAnalyticsSchema.nullable(),
})

export type WebDashboardBundle = z.infer<typeof webDashboardBundleSchema>
