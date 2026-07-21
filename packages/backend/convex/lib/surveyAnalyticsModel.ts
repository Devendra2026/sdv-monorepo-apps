import type { Doc } from "../_generated/dataModel";
import { formatDateKey } from "../shared/calendar";

/** Minimal survey fields needed for analytics counter and event math. */
export type SurveyAnalyticsSnapshot = {
  municipalityId: Doc<"surveys">["municipalityId"];
  districtId: Doc<"surveys">["districtId"];
  surveyorId: Doc<"surveys">["surveyorId"];
  wardNo?: string;
  city: Doc<"surveys">["city"];
  status: Doc<"surveys">["status"];
  qcStatus: Doc<"surveys">["qcStatus"];
  submittedAt?: number;
  createdAtMs: number;
  completionPct?: number;
};

export type SurveyStateCounters = {
  total: number;
  drafts: number;
  submitted: number;
  qcApproved: number;
  qcRejected: number;
  qcPending: number;
};

export type DailyEventCounters = {
  dateKey: string;
  created: number;
  submitted: number;
  approved: number;
  rejected: number;
};

export type QcDecisionKind = "approve" | "reject";

const EMPTY_COUNTERS: SurveyStateCounters = {
  total: 0,
  drafts: 0,
  submitted: 0,
  qcApproved: 0,
  qcRejected: 0,
  qcPending: 0,
};

/** Build an analytics snapshot from a survey document. */
export function snapshotFromSurvey(survey: Doc<"surveys">): SurveyAnalyticsSnapshot {
  return {
    municipalityId: survey.municipalityId,
    districtId: survey.districtId,
    surveyorId: survey.surveyorId,
    wardNo: survey.wardNo,
    city: survey.city,
    status: survey.status,
    qcStatus: survey.qcStatus,
    submittedAt: survey.submittedAt,
    createdAtMs: survey._creationTime,
    completionPct: survey.completionPct,
  };
}

/** Current-state counters for one survey snapshot (dimensions may overlap). */
export function countersForSnapshot(snapshot: SurveyAnalyticsSnapshot): SurveyStateCounters {
  return {
    total: 1,
    drafts: snapshot.status === "draft" ? 1 : 0,
    submitted: snapshot.status === "submitted" ? 1 : 0,
    qcApproved: snapshot.qcStatus === "approved" ? 1 : 0,
    qcRejected: snapshot.qcStatus === "rejected" ? 1 : 0,
    qcPending: snapshot.status === "submitted" && snapshot.qcStatus === "pending" ? 1 : 0,
  };
}

/** Signed delta between two current-state counter vectors. */
export function diffSurveyCounters(
  before: SurveyStateCounters,
  after: SurveyStateCounters,
): SurveyStateCounters {
  return {
    total: after.total - before.total,
    drafts: after.drafts - before.drafts,
    submitted: after.submitted - before.submitted,
    qcApproved: after.qcApproved - before.qcApproved,
    qcRejected: after.qcRejected - before.qcRejected,
    qcPending: after.qcPending - before.qcPending,
  };
}

function emptyDaily(dateKey: string): DailyEventCounters {
  return { dateKey, created: 0, submitted: 0, approved: 0, rejected: 0 };
}

function subtractDaily(a: DailyEventCounters, b: DailyEventCounters): DailyEventCounters {
  return {
    dateKey: a.dateKey,
    created: a.created - b.created,
    submitted: a.submitted - b.submitted,
    approved: a.approved - b.approved,
    rejected: a.rejected - b.rejected,
  };
}

/** Daily event counters implied by a single survey snapshot (creation + current submit event). */
export function dailyEventsForSnapshot(snapshot: SurveyAnalyticsSnapshot): DailyEventCounters[] {
  const byDate = new Map<string, DailyEventCounters>();

  const bump = (dateKey: string, patch: Partial<Omit<DailyEventCounters, "dateKey">>) => {
    const current = byDate.get(dateKey) ?? emptyDaily(dateKey);
    byDate.set(dateKey, {
      dateKey,
      created: current.created + (patch.created ?? 0),
      submitted: current.submitted + (patch.submitted ?? 0),
      approved: current.approved + (patch.approved ?? 0),
      rejected: current.rejected + (patch.rejected ?? 0),
    });
  };

  bump(formatDateKey(snapshot.createdAtMs), { created: 1 });

  // Historical submit events survive later approval/rejection/reopen.
  if (snapshot.submittedAt !== undefined) {
    bump(formatDateKey(snapshot.submittedAt), { submitted: 1 });
  }

  return [...byDate.values()];
}

/** Daily event delta for a survey transition (before → after). */
export function dailyEventsForTransition(
  before: SurveyAnalyticsSnapshot | null,
  after: SurveyAnalyticsSnapshot | null,
): DailyEventCounters[] {
  const beforeByDate = new Map<string, DailyEventCounters>();
  const afterByDate = new Map<string, DailyEventCounters>();

  for (const row of before ? dailyEventsForSnapshot(before) : []) {
    beforeByDate.set(row.dateKey, row);
  }
  for (const row of after ? dailyEventsForSnapshot(after) : []) {
    afterByDate.set(row.dateKey, row);
  }

  const keys = new Set([...beforeByDate.keys(), ...afterByDate.keys()]);
  const deltas: DailyEventCounters[] = [];

  for (const dateKey of keys) {
    const beforeRow = beforeByDate.get(dateKey) ?? emptyDaily(dateKey);
    const afterRow = afterByDate.get(dateKey) ?? emptyDaily(dateKey);
    const delta = subtractDaily(afterRow, beforeRow);
    if (delta.created || delta.submitted || delta.approved || delta.rejected) {
      deltas.push(delta);
    }
  }

  return deltas;
}

/** QC decision event counters for one immutable decision on its IST day. */
export function qcDecisionDailyEvent(
  decision: QcDecisionKind,
  decidedAtMs: number,
): Pick<DailyEventCounters, "dateKey" | "approved" | "rejected"> {
  return {
    dateKey: formatDateKey(decidedAtMs),
    approved: decision === "approve" ? 1 : 0,
    rejected: decision === "reject" ? 1 : 0,
  };
}

/** Throws when a counter patch would leave aggregates negative. */
export function assertValidCounterPatch(next: SurveyStateCounters): void {
  if (
    next.total < 0 ||
    next.drafts < 0 ||
    next.submitted < 0 ||
    next.qcApproved < 0 ||
    next.qcRejected < 0 ||
    next.qcPending < 0
  ) {
    throw new Error("Analytics counter underflow");
  }
}

/** Apply a signed delta to a counter vector, validating the result. */
export function applyCounterDelta(
  current: SurveyStateCounters,
  delta: SurveyStateCounters,
): SurveyStateCounters {
  const next: SurveyStateCounters = {
    total: current.total + delta.total,
    drafts: current.drafts + delta.drafts,
    submitted: current.submitted + delta.submitted,
    qcApproved: current.qcApproved + delta.qcApproved,
    qcRejected: current.qcRejected + delta.qcRejected,
    qcPending: current.qcPending + delta.qcPending,
  };
  assertValidCounterPatch(next);
  return next;
}

export { EMPTY_COUNTERS };
