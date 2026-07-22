/// <reference path="../importMetaGlob.d.ts" />
import { convexTest } from "convex-test"
import { afterEach, describe, expect, it, vi } from "vitest"
import schema from "../schema"
import {
  filterLegacyAnalyticsRows,
  getLegacyMunicipalityStatsRow,
  isLegacyAnalyticsRow,
  loadAllLegacyMunicipalityStatsRows,
  loadLegacyDailyStatsForDate,
  loadLegacyMunicipalityStatsForMunicipalities,
  pickUniqueLegacyRow,
} from "./surveyAnalyticsLookups"

const modules = import.meta.glob("../**/*.ts")

afterEach(() => {
  vi.restoreAllMocks()
})

describe("surveyAnalyticsLookups", () => {
  it("treats omitted generation as legacy", () => {
    expect(isLegacyAnalyticsRow({})).toBe(true)
    expect(isLegacyAnalyticsRow({ generation: undefined })).toBe(true)
    expect(isLegacyAnalyticsRow({ generation: "gen-2026" })).toBe(false)
  })

  it("returns the newest legacy row when duplicates exist (never throws)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const older = { generation: undefined, total: 1, _creationTime: 100 }
    const newer = { generation: undefined, total: 2, _creationTime: 200 }
    expect(pickUniqueLegacyRow([older, newer], "municipality m1")).toEqual(newer)
    expect(warn).toHaveBeenCalled()
  })

  it("prefers legacy over generated and does not throw on mixed pages", () => {
    const legacy = { generation: undefined, total: 1, _creationTime: 50 }
    const generated = { generation: "gen-2026", total: 99, _creationTime: 999 }
    expect(pickUniqueLegacyRow([generated, legacy], "municipality m1")).toEqual(legacy)
  })

  it("returns null when only generated rows exist", () => {
    expect(pickUniqueLegacyRow([{ generation: "gen-2026" }], "municipality m1")).toBeNull()
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

  it("loadLegacyMunicipalityStatsForMunicipalities returns only scoped legacy rows", async () => {
    const t = convexTest(schema, modules)

    const { m1, m2 } = await t.run(async (ctx) => {
      const districtId = await ctx.db.insert("districts", {
        code: "D2",
        name: "District 2",
        stateName: "Maharashtra",
        isActive: true,
      })
      const m1 = await ctx.db.insert("municipalities", {
        districtId,
        code: "M2A",
        name: "Municipality 2A",
        bodyType: "municipal_council",
        isActive: true,
      })
      const m2 = await ctx.db.insert("municipalities", {
        districtId,
        code: "M2B",
        name: "Municipality 2B",
        bodyType: "municipal_council",
        isActive: true,
      })
      return { m1, m2 }
    })

    await t.run(async (ctx) => {
      await ctx.db.insert("surveyMunicipalityStats", {
        generation: "gen-2026",
        municipalityId: m1,
        total: 50,
        drafts: 0,
        submitted: 50,
        qcApproved: 0,
        qcRejected: 0,
        qcPending: 0,
      })
      await ctx.db.insert("surveyMunicipalityStats", {
        municipalityId: m1,
        total: 7,
        drafts: 2,
        submitted: 5,
        qcApproved: 0,
        qcRejected: 0,
        qcPending: 0,
      })
      await ctx.db.insert("surveyMunicipalityStats", {
        municipalityId: m2,
        total: 3,
        drafts: 1,
        submitted: 2,
        qcApproved: 0,
        qcRejected: 0,
        qcPending: 0,
      })
    })

    await t.run(async (ctx) => {
      const scoped = await loadLegacyMunicipalityStatsForMunicipalities(ctx, [m1])
      expect(scoped).toHaveLength(1)
      expect(scoped[0]?.municipalityId).toBe(m1)
      expect(scoped[0]?.total).toBe(7)
      expect(scoped[0]?.generation).toBeUndefined()

      // Deprecated full-table helper still filters to legacy only (both munis).
      const allLegacy = await loadAllLegacyMunicipalityStatsRows(ctx)
      expect(allLegacy).toHaveLength(2)
      expect(allLegacy.every((row: { generation?: string }) => row.generation === undefined)).toBe(true)
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
