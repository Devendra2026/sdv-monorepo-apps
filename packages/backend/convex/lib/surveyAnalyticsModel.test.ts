import { describe, expect, it } from "vitest";
import {
  assertValidCounterPatch,
  countersForSnapshot,
  dailyEventsForTransition,
  qcDecisionDailyEvent,
  type SurveyAnalyticsSnapshot,
} from "./surveyAnalyticsModel";

// 2026-07-21 12:00 IST = 2026-07-21T06:30:00.000Z
const IST_NOON = Date.UTC(2026, 6, 21, 6, 30, 0, 0);

function snapshot(
  partial: Partial<SurveyAnalyticsSnapshot> & Pick<SurveyAnalyticsSnapshot, "status">,
): SurveyAnalyticsSnapshot {
  return {
    municipalityId: "muni" as SurveyAnalyticsSnapshot["municipalityId"],
    districtId: "district" as SurveyAnalyticsSnapshot["districtId"],
    surveyorId: "surveyor" as SurveyAnalyticsSnapshot["surveyorId"],
    city: "Test City",
    qcStatus: partial.qcStatus ?? "pending",
    createdAtMs: partial.createdAtMs ?? IST_NOON - 86_400_000,
    ...partial,
  };
}

describe("surveyAnalyticsModel", () => {
  it("keeps submission events after approval", () => {
    const before = snapshot({ status: "submitted", submittedAt: IST_NOON });
    const after = snapshot({ status: "approved", qcStatus: "approved", submittedAt: IST_NOON });
    expect(dailyEventsForTransition(before, after)).toEqual([]);
  });

  it("counts each QC decision event on its IST day", () => {
    expect(qcDecisionDailyEvent("approve", IST_NOON)).toEqual({
      dateKey: "2026-07-21",
      approved: 1,
      rejected: 0,
    });
  });

  it("rejects negative aggregate patches", () => {
    expect(() =>
      assertValidCounterPatch({
        total: -1,
        drafts: 0,
        submitted: 0,
        qcApproved: 0,
        qcRejected: 0,
        qcPending: 0,
      }),
    ).toThrow("Analytics counter underflow");
  });

  it("counts overlapping current-state dimensions", () => {
    const rejectedDraft = snapshot({ status: "draft", qcStatus: "rejected" });
    expect(countersForSnapshot(rejectedDraft)).toEqual({
      total: 1,
      drafts: 1,
      submitted: 0,
      qcApproved: 0,
      qcRejected: 1,
      qcPending: 0,
    });
  });

  it("records a submit event only when submittedAt is set", () => {
    const submitted = snapshot({ status: "submitted", submittedAt: IST_NOON });
    expect(dailyEventsForTransition(null, submitted)).toEqual([
      {
        dateKey: "2026-07-20",
        created: 1,
        submitted: 0,
        approved: 0,
        rejected: 0,
      },
      {
        dateKey: "2026-07-21",
        created: 0,
        submitted: 1,
        approved: 0,
        rejected: 0,
      },
    ]);
  });
});
