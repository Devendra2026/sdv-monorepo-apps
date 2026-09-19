/**
 * Large-scope regression for production SystemTimeout / queryStreamNext paths.
 * Seeds many ULBs so admin fan-out exercises mapInChunks stream budgeting.
 */
import { convexTest } from "convex-test"
import { describe, expect, it } from "vitest"
import { api } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
import schema from "../schema"
import { STREAM_FANOUT_CHUNK_SIZE } from "./budgetLimits"

const modules = import.meta.glob("../**/*.ts")

const NOW_MS = Date.UTC(2026, 6, 21, 6, 30, 0, 0)
const ULB_COUNT = 24 // well above STREAM_FANOUT_CHUNK_SIZE and STATS_BATCH_SCOPE_THRESHOLD

function surveyFields(
  districtId: Id<"districts">,
  municipalityId: Id<"municipalities">,
  surveyorId: Id<"users">,
  localId: string
) {
  return {
    localId,
    surveyorId,
    districtId,
    municipalityId,
    wardNo: "1",
    status: "submitted" as const,
    qcStatus: "pending" as const,
    serverVersion: 1,
    clientUpdatedAt: NOW_MS,
    submittedAt: NOW_MS,
    parcelNo: "P1",
    unitNo: "U1",
    isSlum: false,
    mobileNo: "9876543210",
    locality: "Loc",
    colonyName: "Col",
    city: "City",
    pinCode: "282001",
    assessmentYear: "2025-26",
    ownershipType: "owned",
    propertyType: "residential",
    propertyUse: "residential",
    situation: "main",
    roadType: "paved",
    taxRateZone: "A",
    plotSqft: 100,
    plinthSqft: 80,
    municipalWaterConnection: true,
    waterSource: "government_tap" as const,
    sanitationType: "sewer_system" as const,
    municipalWasteCollection: true,
  }
}

describe("large-scope query stream budgets", () => {
  it("admin list, listPaginated, analytics, masters, and currentUser complete with many ULBs", async () => {
    const t = convexTest(schema, modules)
    const clerkId = "admin-large-scope-timeout"

    const { surveyIds, municipalityIds } = await t.run(async (ctx) => {
      const districtId = await ctx.db.insert("districts", {
        code: "D-LS",
        name: "Large Scope District",
        stateName: "UP",
        isActive: true,
      })

      const adminId = await ctx.db.insert("users", {
        clerkId,
        email: "admin-large@test.com",
        name: "Admin",
        role: "admin",
        status: "active",
        wardAssignments: [],
      })

      const surveyorId = await ctx.db.insert("users", {
        clerkId: "surveyor-large-scope",
        email: "surveyor-large@test.com",
        name: "Surveyor",
        role: "surveyor",
        status: "active",
        wardAssignments: ["1"],
      })

      const municipalityIds: Id<"municipalities">[] = []
      const surveyIds: Id<"surveys">[] = []

      for (let i = 0; i < ULB_COUNT; i++) {
        const municipalityId = await ctx.db.insert("municipalities", {
          districtId,
          code: `LS${i}`,
          name: `ULB ${i}`,
          bodyType: "municipal_council",
          isActive: true,
        })
        municipalityIds.push(municipalityId)

        await ctx.db.insert("wards", {
          municipalityId,
          wardNo: "1",
          wardCode: `LS${i}-W01`,
          name: "Ward 1",
        })

        await ctx.db.insert("surveyMunicipalityStats", {
          municipalityId,
          total: 2,
          drafts: 0,
          submitted: 2,
          qcApproved: 0,
          qcRejected: 0,
          qcPending: 2,
        })

        await ctx.db.insert("surveyWardStats", {
          municipalityId,
          wardNo: "1",
          city: `ULB ${i}`,
          total: 2,
          drafts: 0,
          submitted: 2,
          qcApproved: 0,
          qcRejected: 0,
          qcPending: 2,
          activeSurveyorIds: [surveyorId],
        })

        await ctx.db.insert("surveySurveyorStats", {
          surveyorId,
          municipalityId,
          districtId,
          total: 2,
          drafts: 0,
          submitted: 2,
          qcApproved: 0,
          qcRejected: 0,
        })

        await ctx.db.insert("surveyDailyStats", {
          municipalityId,
          dateKey: "2026-07-21",
          created: 2,
          submitted: 2,
        })

        for (let s = 0; s < 2; s++) {
          surveyIds.push(
            await ctx.db.insert(
              "surveys",
              surveyFields(districtId, municipalityId, surveyorId, `local-${i}-${s}`)
            )
          )
        }
      }

      // Touch admin id so unused-local lint stays quiet if role wiring changes.
      expect(adminId).toBeTruthy()

      return { surveyIds, municipalityIds }
    })

    expect(municipalityIds).toHaveLength(ULB_COUNT)
    expect(STREAM_FANOUT_CHUNK_SIZE).toBe(12)

    const asAdmin = t.withIdentity({ subject: clerkId })
    const timings: Record<string, number> = {}

    async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
      const started = Date.now()
      const result = await fn()
      timings[label] = Date.now() - started
      return result
    }

    const me = await timed("currentUser", () => asAdmin.query(api.users.queries.currentUser, {}))
    expect(me?.role).toBe("admin")
    expect(me?.email).toBe("admin-large@test.com")

    const list = await timed("surveys.list", () =>
      asAdmin.query(api.surveys.queries.list, { limit: 50 })
    )
    expect(list.length).toBeGreaterThan(0)
    expect(list.length).toBeLessThanOrEqual(50)

    const page = await timed("surveys.listPaginated", () =>
      asAdmin.query(api.surveys.queries.listPaginated, {
        paginationOpts: { numItems: 20, cursor: null },
        nowMs: NOW_MS,
      })
    )
    expect(page.page.length).toBeGreaterThan(0)
    expect(page.page.length).toBeLessThanOrEqual(20)
    expect(typeof page.isDone).toBe("boolean")

    const detail = await timed("surveys.get", () =>
      asAdmin.query(api.surveys.queries.get, { id: surveyIds[0]! })
    )
    expect(detail?._id).toBe(surveyIds[0])
    expect(Array.isArray(detail?.floors)).toBe(true)

    const counts = await timed("analytics.counts", () =>
      asAdmin.query(api.analytics.queries.counts, { nowMs: NOW_MS })
    )
    expect(counts.total).toBeGreaterThan(0)

    const activity = await timed("analytics.recentActivity", () =>
      asAdmin.query(api.analytics.queries.recentActivity, {})
    )
    expect(activity.length).toBeGreaterThan(0)

    const bundle = await timed("analytics.analyticsBundle", () =>
      asAdmin.query(api.analytics.queries.analyticsBundle, { nowMs: NOW_MS, trendDays: 14 })
    )
    expect(bundle).not.toBeNull()
    expect(bundle!.breakdown.summary.total).toBeGreaterThan(0)
    expect(bundle!.dailyTrend.length).toBeGreaterThan(0)

    const qc = await timed("analytics.qcSupervisorBundle", () =>
      asAdmin.query(api.analytics.queries.qcSupervisorBundle, { nowMs: NOW_MS, trendDays: 14 })
    )
    expect(qc).not.toBeNull()
    expect(typeof qc!.truncated).toBe("boolean")

    const masterCounts = await timed("masters.dashboardCounts", () =>
      asAdmin.query(api.masters.queries.dashboardCounts, { nowMs: NOW_MS })
    )
    expect(masterCounts.total).toBe(counts.total)

    const masters = await timed("masters.bundle", () =>
      asAdmin.query(api.masters.queries.bundle, {
        includeWards: true,
        includeTenantCatalog: true,
      })
    )
    expect(masters.ulbs.length).toBe(ULB_COUNT)
    expect(masters.wards.length).toBe(ULB_COUNT)

    // Synthetic fixture should finish quickly; record measured ms (not invented).
    for (const [label, ms] of Object.entries(timings)) {
      expect(ms, `${label} took ${ms}ms`).toBeLessThan(30_000)
    }

    console.info(
      JSON.stringify({
        kind: "large_scope_query_timings_ms",
        ulbCount: ULB_COUNT,
        streamFanoutChunkSize: STREAM_FANOUT_CHUNK_SIZE,
        timings,
      })
    )
  })

  it("listPaginated with municipalityId uses indexed path and returns empty for empty ULB", async () => {
    const t = convexTest(schema, modules)
    const clerkId = "admin-empty-ulb-page"

    const municipalityId = await t.run(async (ctx) => {
      const districtId = await ctx.db.insert("districts", {
        code: "D-EMPTY",
        name: "Empty",
        stateName: "UP",
        isActive: true,
      })
      await ctx.db.insert("users", {
        clerkId,
        email: "admin-empty@test.com",
        name: "Admin",
        role: "admin",
        status: "active",
        wardAssignments: [],
      })
      return await ctx.db.insert("municipalities", {
        districtId,
        code: "EMPTY1",
        name: "Empty ULB",
        bodyType: "municipal_council",
        isActive: true,
      })
    })

    const asAdmin = t.withIdentity({ subject: clerkId })
    const page = await asAdmin.query(api.surveys.queries.listPaginated, {
      paginationOpts: { numItems: 10, cursor: null },
      municipalityId,
      nowMs: NOW_MS,
    })
    expect(page.page).toEqual([])
    expect(page.isDone).toBe(true)
  })
})
