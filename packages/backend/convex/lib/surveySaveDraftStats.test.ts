/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import {
  getLegacyMunicipalityStatsRow,
  getLegacyWardStatsRow,
} from "./surveyAnalyticsLookups";

const modules = import.meta.glob("../**/*.ts");

describe("surveys.saveDraft", () => {
  it("moves legacy ward rollups when a draft changes ward", async () => {
    const t = convexTest(schema, modules);
    const clerkId = "surveyor-draft-ward-move";

    const { municipalityId } = await t.run(async (ctx) => {
      const districtId = await ctx.db.insert("districts", {
        code: "D1",
        name: "District 1",
        stateName: "Maharashtra",
        isActive: true,
      });
      const municipalityId = await ctx.db.insert("municipalities", {
        districtId,
        code: "M1",
        name: "Municipality 1",
        bodyType: "municipal_council",
        isActive: true,
      });
      await ctx.db.insert("wards", {
        municipalityId,
        wardNo: "1",
        wardCode: "M1-W01",
        name: "Ward 1",
      });
      await ctx.db.insert("wards", {
        municipalityId,
        wardNo: "2",
        wardCode: "M1-W02",
        name: "Ward 2",
      });
      await ctx.db.insert("users", {
        clerkId,
        email: "surveyor-draft-ward-move@test.com",
        name: "Surveyor",
        role: "surveyor",
        status: "active",
        municipalityId,
        wardAssignments: ["1", "2"],
      });
      return { municipalityId };
    });

    const asSurveyor = t.withIdentity({ subject: clerkId });
    const localId = "draft-ward-move-local";
    const clientUpdatedAt = Date.UTC(2026, 6, 21, 6, 30, 0, 0);

    await asSurveyor.mutation(api.surveys.mutations.saveDraft, {
      localId,
      municipalityId,
      clientUpdatedAt,
      wardNo: "1",
    });

    await asSurveyor.mutation(api.surveys.mutations.saveDraft, {
      localId,
      municipalityId,
      clientUpdatedAt: clientUpdatedAt + 1,
      wardNo: "2",
    });

    await t.run(async (ctx) => {
      const ward1 = await getLegacyWardStatsRow(ctx, municipalityId, "1");
      const ward2 = await getLegacyWardStatsRow(ctx, municipalityId, "2");
      const muni = await getLegacyMunicipalityStatsRow(ctx, municipalityId);

      expect(ward1?.drafts ?? 0).toBe(0);
      expect(ward2?.drafts ?? 0).toBe(1);
      expect(muni?.drafts).toBe(1);
      expect(muni?.total).toBe(1);
    });
  });
});
