import { describe, expect, it } from "vitest"
import { buildAdminTenantTree, compareWardNo } from "./adminTree"

describe("compareWardNo", () => {
  it("sorts ward numbers numerically", () => {
    expect(["10", "2", "1"].sort(compareWardNo)).toEqual(["1", "2", "10"])
  })
})

describe("buildAdminTenantTree", () => {
  it("nests ULBs and wards under districts, sorted, without storage blobs", () => {
    const tree = buildAdminTenantTree(
      [
        {
          _id: "d2" as never,
          code: "B",
          name: "Beta",
          stateName: "UP",
          isActive: true,
        },
        {
          _id: "d1" as never,
          code: "A",
          name: "Alpha",
          stateName: "UP",
          isActive: true,
        },
      ],
      [
        {
          _id: "m2" as never,
          districtId: "d1" as never,
          code: "M2",
          name: "Zeta ULB",
          bodyType: "town_panchayat",
          postalCode: "282001",
          isActive: true,
          executiveSignatureStorageId: "sig1" as never,
        },
        {
          _id: "m1" as never,
          districtId: "d1" as never,
          code: "M1",
          name: "Alpha ULB",
          bodyType: "municipal_council",
          isActive: true,
        },
        {
          _id: "m3" as never,
          districtId: "d2" as never,
          code: "M3",
          name: "Beta ULB",
          bodyType: "municipal_council",
          isActive: true,
        },
      ],
      [
        {
          _id: "w2" as never,
          municipalityId: "m1" as never,
          wardNo: "10",
          wardCode: "M1-W10",
          name: "Ward 10",
        },
        {
          _id: "w1" as never,
          municipalityId: "m1" as never,
          wardNo: "2",
          wardCode: "M1-W02",
          name: "Ward 2",
        },
      ]
    )

    expect(tree.map((d) => d.name)).toEqual(["Alpha", "Beta"])
    expect(tree[0]!.ulbs.map((u) => u.name)).toEqual(["Alpha ULB", "Zeta ULB"])
    expect(tree[0]!.ulbs[0]!.wards.map((w) => w.wardNo)).toEqual(["2", "10"])
    expect(tree[0]!.ulbs[1]).not.toHaveProperty("executiveSignatureStorageId")
    expect(tree[0]!.ulbs[1]).toMatchObject({
      _id: "m2",
      code: "M2",
      postalCode: "282001",
      bodyType: "town_panchayat",
    })
  })
})
