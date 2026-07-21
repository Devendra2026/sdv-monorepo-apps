/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import * as surveyScopeStats from "../lib/surveyScopeStats";

const modules = import.meta.glob("../**/*.ts");

async function seedImportTenant(t: ReturnType<typeof convexTest>) {
  const clerkId = "supervisor-import-atomicity";
  const municipalityId = await t.run(async (ctx) => {
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
    await ctx.db.insert("users", {
      clerkId,
      email: "supervisor-import-atomicity@test.com",
      name: "Supervisor",
      role: "supervisor",
      status: "active",
      municipalityId,
      wardAssignments: ["1"],
    });
    return municipalityId;
  });
  return { clerkId, municipalityId };
}

describe("excel import atomicity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("importExcelSurveyRow rolls back the survey when stats insert throws", async () => {
    const t = convexTest(schema, modules);
    const { clerkId, municipalityId } = await seedImportTenant(t);
    const localId = "atomic-create-local";

    vi.spyOn(surveyScopeStats, "recordSurveyStatsInsert").mockRejectedValue(
      new Error("stats rollup failed"),
    );

    const asSupervisor = t.withIdentity({ subject: clerkId });
    await expect(
      asSupervisor.mutation(api.export.mutations.importExcelSurveyRow, {
        survey: {
          localId,
          municipalityId,
          wardNo: "1",
          parcelNo: "P1",
          unitNo: "U1",
        },
      }),
    ).rejects.toThrow(/stats rollup failed/i);

    await t.run(async (ctx) => {
      const supervisor = await ctx.db
        .query("users")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
        .unique();
      expect(supervisor).not.toBeNull();
      const row = await ctx.db
        .query("surveys")
        .withIndex("by_surveyor_localId", (q) =>
          q.eq("surveyorId", supervisor!._id).eq("localId", localId),
        )
        .unique();
      expect(row).toBeNull();
    });
  });

  it("importExcelBundle does not commit a survey when stats insert throws mid-batch", async () => {
    const t = convexTest(schema, modules);
    const { clerkId, municipalityId } = await seedImportTenant(t);

    vi.spyOn(surveyScopeStats, "recordSurveyStatsInsert").mockRejectedValue(
      new Error("stats rollup failed"),
    );

    const asSupervisor = t.withIdentity({ subject: clerkId });
    await expect(
      asSupervisor.mutation(api.export.mutations.importExcelBundle, {
        surveys: [
          {
            localId: "atomic-bundle-1",
            municipalityId,
            wardNo: "1",
            parcelNo: "P1",
            unitNo: "U1",
          },
        ],
      }),
    ).rejects.toThrow(/stats rollup failed/i);

    await t.run(async (ctx) => {
      const surveys = await ctx.db.query("surveys").collect();
      expect(surveys).toHaveLength(0);
    });
  });

  it("importExcelBundle still records validation errors without touching surveys", async () => {
    const t = convexTest(schema, modules);
    const { clerkId, municipalityId } = await seedImportTenant(t);
    const asSupervisor = t.withIdentity({ subject: clerkId });

    const result = await asSupervisor.mutation(api.export.mutations.importExcelBundle, {
      surveys: [
        {
          localId: "good-row",
          municipalityId,
          wardNo: "1",
          parcelNo: "P1",
          unitNo: "U1",
        },
        {
          localId: "missing-muni",
          municipalityId: "000000000000000000000000" as typeof municipalityId,
          wardNo: "1",
          parcelNo: "P2",
          unitNo: "U2",
        },
      ],
    });

    expect(result.created).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.errors).toEqual([
      expect.objectContaining({ localId: "missing-muni", message: "Unknown municipality" }),
    ]);
  });
});
