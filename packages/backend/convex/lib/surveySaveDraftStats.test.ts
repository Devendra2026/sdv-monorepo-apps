/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { ConvexError } from "convex/values"
import { describe, expect, it } from "vitest"
import { api } from "../_generated/api"
import schema from "../schema"
import { getLegacyMunicipalityStatsRow, getLegacyWardStatsRow } from "./surveyAnalyticsLookups"

const modules = import.meta.glob("../**/*.ts")

/** Capture unhandled rejections that would crash a Convex isolate in production. */
function trackUnhandledRejections() {
  const reasons: unknown[] = []
  const onUnhandled = (reason: unknown) => {
    reasons.push(reason)
  }
  process.on("unhandledRejection", onUnhandled)
  return {
    reasons,
    stop: () => {
      process.off("unhandledRejection", onUnhandled)
    },
  }
}

describe("surveys.saveDraft", () => {
  it("moves legacy ward rollups when a draft changes ward", async () => {
    const t = convexTest(schema, modules)
    const clerkId = "surveyor-draft-ward-move"

    const { municipalityId } = await t.run(async (ctx) => {
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
      await ctx.db.insert("wards", {
        municipalityId,
        wardNo: "1",
        wardCode: "M1-W01",
        name: "Ward 1",
      })
      await ctx.db.insert("wards", {
        municipalityId,
        wardNo: "2",
        wardCode: "M1-W02",
        name: "Ward 2",
      })
      await ctx.db.insert("users", {
        clerkId,
        email: "surveyor-draft-ward-move@test.com",
        name: "Surveyor",
        role: "surveyor",
        status: "active",
        municipalityId,
        wardAssignments: ["1", "2"],
      })
      return { municipalityId }
    })

    const asSurveyor = t.withIdentity({ subject: clerkId })
    const localId = "draft-ward-move-local"
    const clientUpdatedAt = Date.UTC(2026, 6, 21, 6, 30, 0, 0)

    await asSurveyor.mutation(api.surveys.mutations.saveDraft, {
      localId,
      municipalityId,
      clientUpdatedAt,
      wardNo: "1",
    })

    await asSurveyor.mutation(api.surveys.mutations.saveDraft, {
      localId,
      municipalityId,
      clientUpdatedAt: clientUpdatedAt + 1,
      wardNo: "2",
    })

    await t.run(async (ctx) => {
      const ward1 = await getLegacyWardStatsRow(ctx, municipalityId, "1")
      const ward2 = await getLegacyWardStatsRow(ctx, municipalityId, "2")
      const muni = await getLegacyMunicipalityStatsRow(ctx, municipalityId)

      expect(ward1?.drafts ?? 0).toBe(0)
      expect(ward2?.drafts ?? 0).toBe(1)
      expect(muni?.drafts).toBe(1)
      expect(muni?.total).toBe(1)
    })
  })

  it("rejects out-of-scope municipality as ConvexError without unhandled rejection", async () => {
    const tracker = trackUnhandledRejections()
    try {
      const t = convexTest(schema, modules)
      const clerkId = "surveyor-draft-scope-reject"

      const { otherMunicipalityId } = await t.run(async (ctx) => {
        const districtId = await ctx.db.insert("districts", {
          code: "D2",
          name: "District 2",
          stateName: "Maharashtra",
          isActive: true,
        })
        const municipalityId = await ctx.db.insert("municipalities", {
          districtId,
          code: "M2",
          name: "Municipality 2",
          bodyType: "municipal_council",
          isActive: true,
        })
        const otherMunicipalityId = await ctx.db.insert("municipalities", {
          districtId,
          code: "M3",
          name: "Municipality 3",
          bodyType: "municipal_council",
          isActive: true,
        })
        await ctx.db.insert("wards", {
          municipalityId,
          wardNo: "1",
          wardCode: "M2-W01",
          name: "Ward 1",
        })
        await ctx.db.insert("users", {
          clerkId,
          email: "surveyor-draft-scope-reject@test.com",
          name: "Surveyor",
          role: "surveyor",
          status: "active",
          municipalityId,
          wardAssignments: ["1"],
        })
        return { otherMunicipalityId }
      })

      const asSurveyor = t.withIdentity({ subject: clerkId })
      await expect(
        asSurveyor.mutation(api.surveys.mutations.saveDraft, {
          localId: "draft-scope-reject-local",
          municipalityId: otherMunicipalityId,
          clientUpdatedAt: Date.UTC(2026, 6, 21, 6, 30, 0, 0),
          wardNo: "1",
        })
      ).rejects.toThrow(ConvexError)

      // Let any sibling-promise rejections surface if the opening gates were parallel.
      await new Promise((r) => setTimeout(r, 0))
      expect(tracker.reasons).toEqual([])
    } finally {
      tracker.stop()
    }
  })

  it("rejects unknown ward as BAD_REQUEST without unhandled rejection", async () => {
    const tracker = trackUnhandledRejections()
    try {
      const t = convexTest(schema, modules)
      const clerkId = "surveyor-draft-unknown-ward"

      const { municipalityId } = await t.run(async (ctx) => {
        const districtId = await ctx.db.insert("districts", {
          code: "D3",
          name: "District 3",
          stateName: "Maharashtra",
          isActive: true,
        })
        const municipalityId = await ctx.db.insert("municipalities", {
          districtId,
          code: "M4",
          name: "Municipality 4",
          bodyType: "municipal_council",
          isActive: true,
        })
        await ctx.db.insert("wards", {
          municipalityId,
          wardNo: "1",
          wardCode: "M4-W01",
          name: "Ward 1",
        })
        await ctx.db.insert("users", {
          clerkId,
          email: "surveyor-draft-unknown-ward@test.com",
          name: "Surveyor",
          role: "surveyor",
          status: "active",
          municipalityId,
          wardAssignments: ["1", "99"],
        })
        return { municipalityId }
      })

      const asSurveyor = t.withIdentity({ subject: clerkId })
      let caught: unknown
      try {
        await asSurveyor.mutation(api.surveys.mutations.saveDraft, {
          localId: "draft-unknown-ward-local",
          municipalityId,
          clientUpdatedAt: Date.UTC(2026, 6, 21, 6, 30, 0, 0),
          wardNo: "99",
        })
      } catch (error) {
        caught = error
      }
      expect(caught).toBeInstanceOf(ConvexError)
      const payload =
        caught instanceof ConvexError
          ? typeof caught.data === "object" && caught.data !== null
            ? (caught.data as { code?: string; message?: string })
            : (JSON.parse(caught.message) as { code?: string; message?: string })
          : {}
      expect(payload.code).toBe("BAD_REQUEST")
      expect(payload.message ?? "").toMatch(/unknown ward/i)

      await new Promise((r) => setTimeout(r, 0))
      expect(tracker.reasons).toEqual([])
    } finally {
      tracker.stop()
    }
  })

  it("saves when duplicate ward rows exist for the same wardNo", async () => {
    const tracker = trackUnhandledRejections()
    try {
      const t = convexTest(schema, modules)
      const clerkId = "surveyor-draft-dup-ward"

      const { municipalityId } = await t.run(async (ctx) => {
        const districtId = await ctx.db.insert("districts", {
          code: "D4",
          name: "District 4",
          stateName: "Maharashtra",
          isActive: true,
        })
        const municipalityId = await ctx.db.insert("municipalities", {
          districtId,
          code: "M5",
          name: "Municipality 5",
          bodyType: "municipal_council",
          isActive: true,
        })
        await ctx.db.insert("wards", {
          municipalityId,
          wardNo: "1",
          wardCode: "M5-W01a",
          name: "Ward 1a",
        })
        await ctx.db.insert("wards", {
          municipalityId,
          wardNo: "1",
          wardCode: "M5-W01b",
          name: "Ward 1b",
        })
        await ctx.db.insert("users", {
          clerkId,
          email: "surveyor-draft-dup-ward@test.com",
          name: "Surveyor",
          role: "surveyor",
          status: "active",
          municipalityId,
          wardAssignments: ["1"],
        })
        return { municipalityId }
      })

      const asSurveyor = t.withIdentity({ subject: clerkId })
      const surveyId = await asSurveyor.mutation(api.surveys.mutations.saveDraft, {
        localId: "draft-dup-ward-local",
        municipalityId,
        clientUpdatedAt: Date.UTC(2026, 6, 21, 6, 30, 0, 0),
        wardNo: "1",
      })
      expect(surveyId).toBeTruthy()

      await new Promise((r) => setTimeout(r, 0))
      expect(tracker.reasons).toEqual([])
    } finally {
      tracker.stop()
    }
  })
})
