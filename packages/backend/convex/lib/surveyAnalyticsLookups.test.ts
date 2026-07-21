/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../schema";
import {
  filterLegacyAnalyticsRows,
  getLegacyMunicipalityStatsRow,
  isLegacyAnalyticsRow,
  pickUniqueLegacyRow,
} from "./surveyAnalyticsLookups";

const modules = import.meta.glob("../**/*.ts");

describe("surveyAnalyticsLookups", () => {
  it("treats omitted generation as legacy", () => {
    expect(isLegacyAnalyticsRow({})).toBe(true);
    expect(isLegacyAnalyticsRow({ generation: undefined })).toBe(true);
    expect(isLegacyAnalyticsRow({ generation: "gen-2026" })).toBe(false);
  });

  it("returns the legacy row when legacy and generated rows coexist", () => {
    const legacy = { generation: undefined, total: 1 };
    const generated = { generation: "gen-2026", total: 99 };
    expect(pickUniqueLegacyRow([generated, legacy], "municipality m1")).toEqual(legacy);
  });

  it("returns null when only generated rows exist", () => {
    expect(pickUniqueLegacyRow([{ generation: "gen-2026" }], "municipality m1")).toBeNull();
  });

  it("throws when multiple legacy rows match the same key", () => {
    expect(() =>
      pickUniqueLegacyRow([{ generation: undefined }, { generation: undefined }], "municipality m1"),
    ).toThrow(/Multiple legacy analytics rows/);
  });

  it("filters mixed-generation index pages to legacy rows only", () => {
    const rows = [
      { generation: "gen-2026", total: 99 },
      { generation: undefined, total: 1 },
      { generation: "gen-2027", total: 50 },
    ];
    expect(filterLegacyAnalyticsRows(rows)).toEqual([{ generation: undefined, total: 1 }]);
  });

  it("loads legacy municipality stats when generated rows share the legacy index", async () => {
    const t = convexTest(schema, modules);

    const municipalityId = await t.run(async (ctx) => {
      const districtId = await ctx.db.insert("districts", {
        code: "D1",
        name: "District 1",
        stateName: "Maharashtra",
        isActive: true,
      });
      return await ctx.db.insert("municipalities", {
        districtId,
        code: "M1",
        name: "Municipality 1",
        bodyType: "municipal_council",
        isActive: true,
      });
    });

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
      });
      await ctx.db.insert("surveyMunicipalityStats", {
        municipalityId,
        total: 1,
        drafts: 1,
        submitted: 0,
        qcApproved: 0,
        qcRejected: 0,
        qcPending: 0,
      });
    });

    await t.run(async (ctx) => {
      const row = await getLegacyMunicipalityStatsRow(ctx, municipalityId);
      expect(row?.total).toBe(1);
      expect(row?.generation).toBeUndefined();
    });
  });
});
