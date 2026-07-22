/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import { describe, expect, it } from "vitest"
import { api } from "../_generated/api"
import schema from "../schema"

const modules = import.meta.glob("../**/*.ts")

describe("tenants.queries.listForAdmin", () => {
  it("returns a slim sorted tree for admins", async () => {
    const t = convexTest(schema, modules)
    const clerkId = "admin-list-for-admin"

    await t.run(async (ctx) => {
      const dBeta = await ctx.db.insert("districts", {
        code: "B",
        name: "Beta",
        stateName: "UP",
        isActive: true,
      })
      const dAlpha = await ctx.db.insert("districts", {
        code: "A",
        name: "Alpha",
        stateName: "UP",
        isActive: true,
      })
      await ctx.db.insert("districts", {
        code: "X",
        name: "Inactive",
        stateName: "UP",
        isActive: false,
      })

      const m1 = await ctx.db.insert("municipalities", {
        districtId: dAlpha,
        code: "M1",
        name: "Alpha ULB",
        bodyType: "municipal_council",
        isActive: true,
      })
      await ctx.db.insert("municipalities", {
        districtId: dAlpha,
        code: "M2",
        name: "Zeta ULB",
        bodyType: "town_panchayat",
        postalCode: "282001",
        isActive: true,
      })
      await ctx.db.insert("municipalities", {
        districtId: dBeta,
        code: "M3",
        name: "Beta ULB",
        bodyType: "municipal_council",
        isActive: true,
      })

      await ctx.db.insert("wards", {
        municipalityId: m1,
        wardNo: "10",
        wardCode: "M1-W10",
        name: "Ward 10",
      })
      await ctx.db.insert("wards", {
        municipalityId: m1,
        wardNo: "2",
        wardCode: "M1-W02",
        name: "Ward 2",
      })

      await ctx.db.insert("users", {
        clerkId,
        email: "admin-list@test.com",
        name: "Admin",
        role: "admin",
        status: "active",
        wardAssignments: [],
      })
    })

    const asAdmin = t.withIdentity({ subject: clerkId })
    const tree = await asAdmin.query(api.tenants.queries.listForAdmin, {})

    expect(tree.map((d) => d.name)).toEqual(["Alpha", "Beta"])
    expect(tree[0]!.ulbs.map((u) => u.name)).toEqual(["Alpha ULB", "Zeta ULB"])
    expect(tree[0]!.ulbs[0]!.wards.map((w) => w.wardNo)).toEqual(["2", "10"])
    for (const d of tree) {
      for (const u of d.ulbs) {
        expect(u).not.toHaveProperty("executiveSignatureStorageId")
      }
    }
  })
})
