import { describe, expect, it } from "vitest"
import type { Id } from "../_generated/dataModel"
import { municipalityStatsRowLooksConsistent } from "./surveyScopeStats"
import { computeDashboardCountsFromSlice, pendingQcCount } from "./surveyStatsAggregate"

describe("pendingQcCount", () => {
  it("equals submitted when reject unused (non-draft pool minus approved)", () => {
    expect(pendingQcCount(120, 40)).toBe(120)
    expect(pendingQcCount(0, 10)).toBe(0)
  })

  it("prefers stored qcPending when higher than submitted (stale submitted)", () => {
    expect(pendingQcCount(80, 40, 100)).toBe(100)
  })
})

describe("computeDashboardCountsFromSlice", () => {
  it("sets total to all docs and pending from submitted queue", () => {
    const muni = "m1" as Id<"municipalities">
    const dist = "d1" as Id<"districts">
    const surveyor = "u1" as Id<"users">
    const rows = [
      {
        _id: "s1" as Id<"surveys">,
        status: "draft" as const,
        qcStatus: "pending" as const,
        districtId: dist,
        municipalityId: muni,
        wardNo: "1",
        surveyorId: surveyor,
        submittedAt: undefined,
        _creationTime: 1,
        city: "X",
      },
      {
        _id: "s2" as Id<"surveys">,
        status: "submitted" as const,
        qcStatus: "pending" as const,
        districtId: dist,
        municipalityId: muni,
        wardNo: "1",
        surveyorId: surveyor,
        submittedAt: 2,
        _creationTime: 2,
        city: "X",
      },
      {
        _id: "s3" as Id<"surveys">,
        status: "approved" as const,
        qcStatus: "approved" as const,
        districtId: dist,
        municipalityId: muni,
        wardNo: "1",
        surveyorId: surveyor,
        submittedAt: 3,
        _creationTime: 3,
        city: "X",
      },
    ]
    const counts = computeDashboardCountsFromSlice(rows, null)
    expect(counts.total).toBe(3)
    expect(counts.drafts).toBe(1)
    expect(counts.submitted).toBe(1)
    expect(counts.approved).toBe(1)
    expect(counts.pending).toBe(1)
  })
})

describe("municipalityStatsRowLooksConsistent", () => {
  it("allows drafts+qc overlap that would fail the old statusSum check", () => {
    expect(
      municipalityStatsRowLooksConsistent({
        municipalityId: "m1" as Id<"municipalities">,
        total: 10,
        drafts: 4,
        submitted: 3,
        qcApproved: 3,
        qcRejected: 2,
        qcPending: 3,
      })
    ).toBe(true)
  })

  it("rejects impossible drafts > total", () => {
    expect(
      municipalityStatsRowLooksConsistent({
        municipalityId: "m1" as Id<"municipalities">,
        total: 5,
        drafts: 6,
        submitted: 0,
        qcApproved: 0,
        qcRejected: 0,
        qcPending: 0,
      })
    ).toBe(false)
  })
})
