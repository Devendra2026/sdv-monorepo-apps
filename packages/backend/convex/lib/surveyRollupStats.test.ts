import { describe, expect, it } from "vitest"
import type { Id } from "../_generated/dataModel"
import { sumWardStatsRollups, unassignedWardGap, type WardStatsRollup } from "./surveyRollupStats"
import { pendingQcCount } from "./surveyStatsAggregate"

function ward(partial: Partial<WardStatsRollup> & Pick<WardStatsRollup, "wardNo" | "municipalityId">): WardStatsRollup {
  return {
    city: "",
    total: 0,
    drafts: 0,
    submitted: 0,
    qcApproved: 0,
    qcRejected: 0,
    qcPending: 0,
    activeSurveyorIds: [],
    ...partial,
  }
}

describe("sumWardStatsRollups + pendingQcCount alignment", () => {
  it("KPI pending from municipality matches sum of ward pending when using stored qcPending", () => {
    const muniId = "m1" as Id<"municipalities">
    const rows = [
      ward({ municipalityId: muniId, wardNo: "1", total: 10, submitted: 4, qcPending: 3, drafts: 2, qcApproved: 4 }),
      ward({ municipalityId: muniId, wardNo: "2", total: 5, submitted: 2, qcPending: 2, drafts: 1, qcApproved: 1 }),
    ]
    const sum = sumWardStatsRollups(rows)
    const muniPending = pendingQcCount(6, 5, sum.qcPending)
    expect(muniPending).toBe(sum.qcPending)
    expect(muniPending).toBe(5)
  })

  it("unassignedWardGap captures blank-ward remainder", () => {
    const muniId = "m1" as Id<"municipalities">
    const rows = [ward({ municipalityId: muniId, wardNo: "1", total: 8, drafts: 1, submitted: 3, qcPending: 2 })]
    const sum = sumWardStatsRollups(rows)
    const gap = unassignedWardGap(
      muniId,
      { total: 10, drafts: 2, submitted: 4, qcApproved: 0, qcRejected: 0, qcPending: 3 },
      sum
    )
    expect(gap).not.toBeNull()
    expect(gap!.wardNo).toBe("Unassigned")
    expect(gap!.total).toBe(2)
    expect(gap!.qcPending).toBe(1)
  })
})
