/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { computeSurveyCompletionPercent } from "./surveyProgress";
import { getLegacyMunicipalityStatsRow } from "./surveyAnalyticsLookups";
import { recordSurveyStatsInsert } from "./surveyScopeStats";

const modules = import.meta.glob("../**/*.ts");

describe("completion fan-in", () => {
  it("updates municipality completion rollups when a floor changes completionPct", async () => {
    const t = convexTest(schema, modules);
    const qcClerkId = "qc-floor-completion-fan-in";

    const { municipalityId, surveyId } = await t.run(async (ctx) => {
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
      const surveyorId = await ctx.db.insert("users", {
        clerkId: "surveyor-floor-completion",
        email: "surveyor-floor-completion@test.com",
        name: "Surveyor",
        role: "surveyor",
        status: "active",
        municipalityId,
        wardAssignments: ["1"],
      });
      await ctx.db.insert("users", {
        clerkId: qcClerkId,
        email: "qc-floor-completion@test.com",
        name: "QC",
        role: "qc_supervisor",
        status: "active",
        municipalityId,
        wardAssignments: ["1"],
      });

      const completionPct = computeSurveyCompletionPercent({
        propertyId: "PROP-1",
        wardNo: "1",
        parcelNo: "P1",
        respondentName: "Respondent",
        mobileNo: "9876543210",
        locality: "Main Street",
        ownershipType: "private",
        propertyUse: "residential",
        plotSqft: 1000,
        floors: [],
        photos: [],
      });
      expect(completionPct).toBe(75);

      const surveyId = await ctx.db.insert("surveys", {
        localId: "local-floor-completion",
        surveyorId,
        districtId,
        municipalityId,
        wardNo: "1",
        status: "submitted",
        qcStatus: "pending",
        serverVersion: 1,
        clientUpdatedAt: Date.UTC(2026, 6, 21, 6, 30, 0, 0),
        submittedAt: Date.UTC(2026, 6, 21, 7, 0, 0, 0),
        completionPct,
        propertyId: "PROP-1",
        parcelNo: "P1",
        unitNo: "U1",
        isSlum: false,
        respondentName: "Respondent",
        mobileNo: "9876543210",
        locality: "Main Street",
        colonyName: "Colony",
        city: "City",
        pinCode: "123456",
        assessmentYear: "2024-25",
        ownershipType: "private",
        propertyType: "residential",
        propertyUse: "residential",
        situation: "normal",
        roadType: "main",
        taxRateZone: "zone1",
        plotSqft: 1000,
        plinthSqft: 0,
        municipalWaterConnection: true,
        waterSource: "government_tap",
        sanitationType: "septic_tank",
        municipalWasteCollection: true,
      });
      const survey = await ctx.db.get(surveyId);
      if (survey) await recordSurveyStatsInsert(ctx, survey);

      return { municipalityId, surveyId };
    });

    const asQc = t.withIdentity({ subject: qcClerkId });
    await asQc.mutation(api.floors.mutations.upsert, {
      surveyId,
      clientFloorId: "floor-1",
      position: 0,
      floorName: "ground_floor",
      usageFactor: "residential",
      usageType: "self_occupied",
      constructionType: "pakka_rcc_rb",
      isOccupied: true,
      areaSqft: 500,
    });

    await t.run(async (ctx) => {
      const survey = await ctx.db.get(surveyId);
      const muni = await getLegacyMunicipalityStatsRow(ctx, municipalityId);

      expect(survey?.completionPct).toBe(83);
      expect(muni?.completionPctSum).toBe(83);
      expect(muni?.completionPctCount).toBe(1);
    });
  });
});
