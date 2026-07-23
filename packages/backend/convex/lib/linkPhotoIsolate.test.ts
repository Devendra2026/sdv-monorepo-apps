/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { describe, expect, it } from "vitest"
import { api } from "../_generated/api"
import type { Id } from "../_generated/dataModel"
import schema from "../schema"

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

async function seedSurveyor(t: ReturnType<typeof convexTest>, clerkId: string, codeSuffix: string) {
  return t.run(async (ctx) => {
    const districtId = await ctx.db.insert("districts", {
      code: `D-${codeSuffix}`,
      name: "Photo District",
      stateName: "Maharashtra",
      isActive: true,
    })
    const municipalityId = await ctx.db.insert("municipalities", {
      districtId,
      code: `M-${codeSuffix}`,
      name: "Photo Municipality",
      bodyType: "municipal_council",
      isActive: true,
    })
    await ctx.db.insert("wards", {
      municipalityId,
      wardNo: "1",
      wardCode: `M-${codeSuffix}-W01`,
      name: "Ward 1",
    })
    const userId = await ctx.db.insert("users", {
      clerkId,
      email: `${clerkId}@test.com`,
      name: "Surveyor",
      role: "surveyor",
      status: "active",
      municipalityId,
      wardAssignments: ["1"],
    })
    return { municipalityId, userId }
  })
}

describe("photos.linkPhoto", () => {
  it("succeeds when duplicate slot rows exist without unhandled rejection", async () => {
    const tracker = trackUnhandledRejections()
    try {
      const t = convexTest(schema, modules)
      const clerkId = "surveyor-photo-dup-slot"
      const { municipalityId, userId } = await seedSurveyor(t, clerkId, "dup")

      const asSurveyor = t.withIdentity({ subject: clerkId })
      const surveyId = await asSurveyor.mutation(api.surveys.mutations.saveDraft, {
        localId: "photo-dup-slot-local",
        municipalityId,
        clientUpdatedAt: Date.UTC(2026, 6, 21, 6, 30, 0, 0),
        wardNo: "1",
      })

      const newStorageId = await t.run(async (ctx) => {
        const oldStorageId = await ctx.storage.store(new Blob(["old-photo"]))
        const newStorageId = await ctx.storage.store(new Blob(["new-photo"]))
        await ctx.db.insert("photos", {
          surveyId,
          slot: "front",
          storageId: oldStorageId,
          sizeKb: 10,
          capturedAt: Date.UTC(2026, 6, 21, 6, 0, 0, 0),
          uploadedBy: userId,
        })
        await ctx.db.insert("photos", {
          surveyId,
          slot: "front",
          storageId: oldStorageId,
          sizeKb: 10,
          capturedAt: Date.UTC(2026, 6, 21, 6, 1, 0, 0),
          uploadedBy: userId,
        })
        return newStorageId
      })

      const photoId = await asSurveyor.mutation(api.photos.mutations.linkPhoto, {
        surveyId,
        slot: "front",
        storageId: newStorageId,
        sizeKb: 20,
        capturedAt: Date.UTC(2026, 6, 21, 6, 30, 0, 0),
      })
      expect(photoId).toBeTruthy()

      await t.run(async (ctx) => {
        const rows = await ctx.db
          .query("photos")
          .withIndex("by_survey_slot", (q) => q.eq("surveyId", surveyId).eq("slot", "front"))
          .take(8)
        expect(rows).toHaveLength(1)
        expect(rows[0]!.storageId).toBe(newStorageId)
        expect(rows[0]!._id).toBe(photoId)
      })

      await new Promise((r) => setTimeout(r, 0))
      expect(tracker.reasons).toEqual([])
    } finally {
      tracker.stop()
    }
  })

  it("rejects access-denied link without creating a photo row", async () => {
    const t = convexTest(schema, modules)
    const ownerClerkId = "surveyor-photo-owner"
    const otherClerkId = "surveyor-photo-other"

    const { ownerMunicipalityId } = await t.run(async (ctx) => {
      const districtId = await ctx.db.insert("districts", {
        code: "D-acc",
        name: "Photo District Access",
        stateName: "Maharashtra",
        isActive: true,
      })
      const ownerMunicipalityId = await ctx.db.insert("municipalities", {
        districtId,
        code: "M-own",
        name: "Owner Municipality",
        bodyType: "municipal_council",
        isActive: true,
      })
      const otherMunicipalityId = await ctx.db.insert("municipalities", {
        districtId,
        code: "M-oth",
        name: "Other Municipality",
        bodyType: "municipal_council",
        isActive: true,
      })
      await ctx.db.insert("wards", {
        municipalityId: ownerMunicipalityId,
        wardNo: "1",
        wardCode: "M-own-W01",
        name: "Ward 1",
      })
      await ctx.db.insert("wards", {
        municipalityId: otherMunicipalityId,
        wardNo: "1",
        wardCode: "M-oth-W01",
        name: "Ward 1",
      })
      await ctx.db.insert("users", {
        clerkId: ownerClerkId,
        email: "owner@test.com",
        name: "Owner",
        role: "surveyor",
        status: "active",
        municipalityId: ownerMunicipalityId,
        wardAssignments: ["1"],
      })
      await ctx.db.insert("users", {
        clerkId: otherClerkId,
        email: "other@test.com",
        name: "Other",
        role: "surveyor",
        status: "active",
        municipalityId: otherMunicipalityId,
        wardAssignments: ["1"],
      })
      return { ownerMunicipalityId }
    })

    const asOwner = t.withIdentity({ subject: ownerClerkId })
    const ownerSurveyId = await asOwner.mutation(api.surveys.mutations.saveDraft, {
      localId: "access-denied-local",
      municipalityId: ownerMunicipalityId,
      clientUpdatedAt: Date.UTC(2026, 6, 21, 6, 30, 0, 0),
      wardNo: "1",
    })

    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob(["orphan-candidate"])))

    const asOther = t.withIdentity({ subject: otherClerkId })
    await expect(
      asOther.mutation(api.photos.mutations.linkPhoto, {
        surveyId: ownerSurveyId,
        slot: "front",
        storageId,
        sizeKb: 12,
        capturedAt: Date.UTC(2026, 6, 21, 6, 30, 0, 0),
      })
    ).rejects.toThrow()

    await t.run(async (ctx) => {
      // Failed mutations roll back storage.delete — assert we never linked a photo row.
      const photos = await ctx.db
        .query("photos")
        .withIndex("by_survey", (q) => q.eq("surveyId", ownerSurveyId))
        .take(4)
      expect(photos).toHaveLength(0)
      void storageId as Id<"_storage">
    })
  })
})
