/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { describe, expect, it } from "vitest"
import schema from "../schema"
import { formatDateKey, startOfDayMs } from "../shared/calendar"
import { loadDailyTrendFromDailyStats } from "./surveyScopeStats"

const modules = import.meta.glob("../**/*.ts")

const MS_PER_DAY = 86_400_000
// 2026-07-21 12:00 IST
const NOW_MS = Date.UTC(2026, 6, 21, 6, 30, 0, 0)

describe("loadDailyTrendFromDailyStats", () => {
  it("includes all legacy daily points when generated rows share the legacy index", async () => {
    const t = convexTest(schema, modules)
    const days = 30

    const { municipalityId, adminId } = await t.run(async (ctx) => {
      const districtId = await ctx.db.insert("districts", {
        code: "D1",
        name: "District 1",
        stateName: "Maharashtra",
        isActive: true,
      })
      const municipalityId = await ctx.db.insert("municipalities", {
        districtId,
        code: "M1",
        name: "Municipality 1",
        bodyType: "municipal_council",
        isActive: true,
      })
      const adminId = await ctx.db.insert("users", {
        clerkId: "admin-daily-trend",
        email: "admin-daily-trend@test.com",
        name: "Admin",
        role: "admin",
        status: "active",
        wardAssignments: [],
      })
      return { municipalityId, adminId }
    })

    await t.run(async (ctx) => {
      const endDayStart = startOfDayMs(NOW_MS)
      const startMs = endDayStart - (days - 1) * MS_PER_DAY

      for (let i = 0; i < days; i++) {
        const dateKey = formatDateKey(startMs + i * MS_PER_DAY)
        await ctx.db.insert("surveyDailyStats", {
          generation: "gen-2026",
          municipalityId,
          dateKey,
          created: 999,
          submitted: 0,
        })
        await ctx.db.insert("surveyDailyStats", {
          municipalityId,
          dateKey,
          created: 1,
          submitted: 0,
        })
      }
    })

    await t.run(async (ctx) => {
      const admin = await ctx.db.get(adminId)
      expect(admin).not.toBeNull()

      const trend = await loadDailyTrendFromDailyStats(ctx, admin!, days, NOW_MS)

      expect(trend).toHaveLength(days)
      expect(trend.reduce((sum, point) => sum + point.created, 0)).toBe(days)
      expect(trend.every((point) => point.created === 1)).toBe(true)
    })
  })

  it("aggregates large ULB scopes via by_date without dropping legacy rows", async () => {
    const t = convexTest(schema, modules)
    const days = 3
    const ulbCount = 12 // > STATS_BATCH_SCOPE_THRESHOLD (10)

    const { adminId, municipalityIds } = await t.run(async (ctx) => {
      const districtId = await ctx.db.insert("districts", {
        code: "D-LARGE",
        name: "District Large",
        stateName: "Maharashtra",
        isActive: true,
      })
      const municipalityIds: Array<string> = []
      for (let i = 0; i < ulbCount; i++) {
        municipalityIds.push(
          await ctx.db.insert("municipalities", {
            districtId,
            code: `ML${i}`,
            name: `Municipality ${i}`,
            bodyType: "municipal_council",
            isActive: true,
          })
        )
      }
      const adminId = await ctx.db.insert("users", {
        clerkId: "admin-large-daily-trend",
        email: "admin-large-daily-trend@test.com",
        name: "Admin",
        role: "admin",
        status: "active",
        wardAssignments: [],
      })
      return { adminId, municipalityIds }
    })

    await t.run(async (ctx) => {
      const endDayStart = startOfDayMs(NOW_MS)
      for (let d = 0; d < days; d++) {
        const dateKey = formatDateKey(endDayStart - (days - 1 - d) * MS_PER_DAY)
        for (const municipalityId of municipalityIds) {
          await ctx.db.insert("surveyDailyStats", {
            municipalityId,
            dateKey,
            created: 2,
            submitted: 1,
          })
        }
      }
    })

    await t.run(async (ctx) => {
      const admin = await ctx.db.get(adminId)
      expect(admin).not.toBeNull()
      const trend = await loadDailyTrendFromDailyStats(ctx, admin!, days, NOW_MS)
      expect(trend).toHaveLength(days)
      expect(trend.every((point) => point.created === ulbCount * 2)).toBe(true)
      expect(trend.every((point) => point.submitted === ulbCount)).toBe(true)
    })
  })
})
