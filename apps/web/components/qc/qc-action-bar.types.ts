import type { SurveyRow } from "@/components/surveys/survey-tables";
import type { SurveyListItem } from "@/schema/surveys/index";

export type QcActionScope = { wardNo?: string; municipalityId?: string; districtId?: string };

/** Stable empty scope — avoids new `{}` on every render when prop is omitted. */
export const EMPTY_QC_SCOPE: QcActionScope = {};

export type QcActionBarProps = {
  survey: Pick<SurveyListItem, "_id" | "status" | "qcStatus" | "propertyId" | "parcelNo">;
  nextSurvey?: SurveyRow;
  scope?: QcActionScope;
  /** review = read-only survey view; edit = correction form */
  mode?: "review" | "edit";
  /** Edit mode: show Approved after a successful save this session */
  correctionsSaved?: boolean;
  onSave?: () => Promise<boolean | void>;
  saving?: boolean;
  onCorrectionsSaved?: () => void;
};

export type QcToolbarVariant =
  | "approved"
  | "review-pending"
  | "review-blocked"
  | "edit-needs-save"
  | "edit-ready"
  | "edit-blocked";

export function resolveQcToolbarVariant(
  mode: "review" | "edit",
  survey: Pick<SurveyListItem, "status" | "qcStatus">,
  correctionsSaved: boolean,
): QcToolbarVariant {
  if (survey.qcStatus === "approved") return "approved";
  const isPending = survey.qcStatus === "pending" && survey.status === "submitted";
  if (mode === "review") {
    return isPending ? "review-pending" : "review-blocked";
  }
  if (isPending && !correctionsSaved) return "edit-needs-save";
  if (isPending && correctionsSaved) return "edit-ready";
  return "edit-blocked";
}

export function getQcStatusHint(
  mode: "review" | "edit",
  survey: Pick<SurveyListItem, "status" | "qcStatus">,
  correctionsSaved: boolean,
): string | null {
  const isApproved = survey.qcStatus === "approved";
  const isPending = survey.qcStatus === "pending" && survey.status === "submitted";
  const isDraft = survey.status === "draft";

  if (mode === "edit" && isPending && !correctionsSaved) {
    return "Save your corrections first, then approve to continue to the next survey.";
  }
  if (mode === "edit" && isPending && correctionsSaved) {
    return "Corrections saved — approve to continue to the next survey automatically.";
  }
  if (isApproved) {
    return "This survey is approved. Use Reopen for review if the data is incorrect.";
  }
  if (isDraft) return "Awaiting surveyor re-submit — approve is unavailable until resubmitted.";
  if (isPending) {
    return "Review the survey. Edit and save corrections if needed, or approve as-is to advance automatically.";
  }
  return null;
}
