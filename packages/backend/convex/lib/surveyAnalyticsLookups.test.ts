/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { describe, expect, it } from "vitest"
import schema from "../schema"
import {
  filterLegacyAnalyticsRows,
  getLegacyMunicipalityStatsRow,
  isLegacyAnalyticsRow,
  loadAllLegacyMunicipalityStatsRows,
  loadLegacyDailyStatsForDate,
  pickUniqueLegacyRow,
} from "./surveyAnalyticsLookups"

const modules = import.meta.glob("../**/*.ts")

describe("surveyAnalyticsLookups", () => {
  it("treats omitted generation as legacy", () => {
    expect(isLegacyAnalyticsRow({})).toBe(true)
    expect(isLegacyAnalyticsRow({ generation: undefined })).toBe(true)
    expect(isLegacyAnalyticsRow({ generation: "gen-2026" })).toBe(false)
  })

  it("returns the legacy row when legacy and generated rows coexist", () => {
    const legacy = { generation: undefined, total: 1 }
    const generated = { generation: "gen-2026", total: 99 }
    expect(pickUniqueLegacyRow([generated, legacy], "municipality m1")).toEqual(legacy)
  })

  it("returns null when only generated rows exist", () => {
    expect(pickUniqueLegacyRow([{ generation: "gen-2026" }], "municipality m1")).toBeNull()
  })

  it("throws when multiple legacy rows match the same key", () => {
    expect(() =>
      pickUniqueLegacyRow([{ generation: undefined }, { generation: undefined }], "municipality m1")
    ).toThrow(/Multiple legacy analytics rows/)
  })

  it("filters mixed-generation index pages to legacy rows only", () => {
    const rows = [
      { generation: "gen-2026", total: 99 },
      { generation: undefined, total: 1 },
      { generation: "gen-2027", total: 50 },
    ]
    expect(filterLegacyAnalyticsRows(rows)).toEqual([{ generation: undefined, total: 1 }])
  })

  it("loads legacy municipality stats when generated rows share the legacy index", async () => {
    const t = convexTest(schema, modules)

    const municipalityId = await t.run(async (ctx) => {
      const districtId = await ctx.db.insert("districts", {
        code: "D1",
        name: "District 1",
        stateName: "Maharashtra",
        isActive: true,
      })
      return await ctx.db.insert("municipalities", {
        districtId,
        code: "M1",
        name: "Municipality 1",
        bodyType: "municipal_council",
        isActive: true,
      })
    })

    await t.run(async (ctx) => {
      await ctx.db.insert("surveyMunicipalityStats", {
        generation: "gen-2026",
        municipalityId,
        total: 99,
        drafts: 0,
        submitted: 99,
        qcApproved: 0,
        qcRejected: 0,
        qcPending: 0,
      })
      await ctx.db.insert("surveyMunicipalityStats", {
        municipalityId,
        total: 1,
        drafts: 1,
        submitted: 0,
        qcApproved: 0,
        qcRejected: 0,
        qcPending: 0,
      })
    })

    await t.run(async (ctx) => {
      const row = await getLegacyMunicipalityStatsRow(ctx, municipalityId)
      expect(row?.total).toBe(1)
      expect(row?.generation).toBeUndefined()
    })
  })

  it("loadAllLegacyMunicipalityStatsRows returns only legacy rows", async () => {
    const t = convexTest(schema, modules)

    const municipalityId = await t.run(async (ctx) => {
      const districtId = await ctx.db.insert("districts", {
        code: "D2",
        name: "District 2",
        stateName: "Maharashtra",
        isActive: true,
      })
      return await ctx.db.insert("municipalities", {
        districtId,
        code: "M2",
        name: "Municipality 2",
        bodyType: "municipal_council",
        isActive: true,
      })
    })

    await t.run(async (ctx) => {
      await ctx.db.insert("surveyMunicipalityStats", {
        generation: "gen-2026",
        municipalityId,
        total: 50,
        drafts: 0,
        submitted: 50,
        qcApproved: 0,
        qcRejected: 0,
        qcPending: 0,
      })
      await ctx.db.insert("surveyMunicipalityStats", {
        municipalityId,
        total: 7,
        drafts: 2,
        submitted: 5,
        qcApproved: 0,
        qcRejected: 0,
        qcPending: 0,
      })
    })

    await t.run(async (ctx) => {
      const rows = await loadAllLegacyMunicipalityStatsRows(ctx)
      expect(rows).toHaveLength(1)
      expect(rows[0]?.total).toBe(7)
      expect(rows[0]?.generation).toBeUndefined()
    })
  })

  it("loadLegacyDailyStatsForDate uses by_date and filters to legacy", async () => {
    const t = convexTest(schema, modules)

    const municipalityId = await t.run(async (ctx) => {
      const districtId = await ctx.db.insert("districts", {
        code: "D3",
        name: "District 3",
        stateName: "Maharashtra",
        isActive: true,
      })
      return await ctx.db.insert("municipalities", {
        districtId,
        code: "M3",
        name: "Municipality 3",
        bodyType: "municipal_council",
        isActive: true,
      })
    })

    await t.run(async (ctx) => {
      await ctx.db.insert("surveyDailyStats", {
        generation: "gen-2026",
        municipalityId,
        dateKey: "2026-07-21",
        created: 99,
        submitted: 99,
      })
      await ctx.db.insert("surveyDailyStats", {
        municipalityId,
        dateKey: "2026-07-21",
        created: 3,
        submitted: 2,
      })
      await ctx.db.insert("surveyDailyStats", {
        municipalityId,
        dateKey: "2026-07-20",
        created: 1,
        submitted: 1,
      })
    })

    await t.run(async (ctx) => {
      const rows = await loadLegacyDailyStatsForDate(ctx, "2026-07-21")
      expect(rows).toHaveLength(1)
      expect(rows[0]?.created).toBe(3)
      expect(rows[0]?.municipalityId).toBe(municipalityId)
    })
  })
})
