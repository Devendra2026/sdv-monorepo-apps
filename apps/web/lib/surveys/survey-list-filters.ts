import type { QcStatus, SurveyStatus } from "@/lib/domain";

type ListStatusFilter = {
  status?: SurveyStatus;
  qcStatus?: QcStatus;
  qcStatuses?: QcStatus[];
};

/** Map Surveys registry tab → server-side list filters. */
export function surveyTabToListFilters(activeTab: string): ListStatusFilter {
  switch (activeTab) {
    case "qcPending":
      return { qcStatus: "pending" as QcStatus };
    case "qcApproved":
      return { qcStatus: "approved" as QcStatus };
    case "qcRejected":
      return { qcStatus: "rejected" as QcStatus };
    case "draft":
      return { status: "draft" as SurveyStatus };
    case "submitted":
      return { status: "submitted" as SurveyStatus };
    default:
      return {};
  }
}

/** Map QC registry tab → server-side list filters. */
export function qcTabToListFilters(activeTab: string): ListStatusFilter {
  switch (activeTab) {
    case "active":
      return { qcStatuses: ["pending", "approved"] as QcStatus[] };
    case "pending":
      return { status: "submitted" as SurveyStatus, qcStatus: "pending" as QcStatus };
    case "approved":
      return { qcStatus: "approved" as QcStatus };
    case "rejected":
      return { qcStatus: "rejected" as QcStatus };
    case "parcelShared":
      return { qcStatuses: ["pending", "approved"] as QcStatus[] };
    default:
      return {};
  }
}

/** Approximate QC-pending count from aggregate summary fields. */
export function estimateQcPendingCount(summary: { submitted?: number; approved?: number; rejected?: number }): number {
  const submitted = summary.submitted ?? 0;
  const closed = (summary.approved ?? 0) + (summary.rejected ?? 0);
  return Math.max(0, submitted - closed);
}
