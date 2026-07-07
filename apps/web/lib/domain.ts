import { can, type Capability, type Role } from "@/lib/permissions"

/**
 * domain.ts — the canonical dropdown options, enums and status maps used by
 * the web forms and tables.
 *
 * CRITICAL: these are RE-EXPORTED from the shared backend modules under
 * `@convex/*`, never hand-redefined. The mobile app and the Convex validators
 * import the same constants, so a value that renders in a <Select> here is
 * guaranteed to pass `validateTaxationSection` / `validateServicesSection` /
 * `validateFloorRow` on the server. If a category is ever edited in the
 * backend, this file picks it up with zero drift.
 *
 * At runtime the live, admin-editable option sets come from `masters.bundle`
 * (use the `useMasters()` hook). These static exports are the typed fallback /
 * the source for zod enums where the backend treats the field as a closed set.
 */

export {
  OWNERSHIP_TYPES,
  PROPERTY_USE_SUBCATEGORIES,
  PROPERTY_USES,
  PROPERTY_USES_REQUIRING_SUBCATEGORY,
  ROAD_TYPES,
  SITUATIONS,
  TAX_RATE_ZONES,
} from "@workspace/convex/lib/masters/taxationMasters"

export {
  SANITATION_TYPE_VALUES,
  SANITATION_TYPES,
  WATER_SOURCE_VALUES,
  WATER_SOURCES,
} from "@workspace/convex/lib/masters/serviceMasters"

export {
  CONSTRUCTION_TYPES,
  FLOOR_NAMES,
  FLOOR_USAGE_FACTORS,
  FLOOR_USAGE_TYPES,
} from "@workspace/convex/lib/masters/areaMasters"

export {
  MAX_SURVEY_OWNERS,
  RESPONDENT_RELATIONSHIP_VALUES,
  RESPONDENT_RELATIONSHIPS,
} from "@workspace/convex/lib/masters/ownerConstants"

/* ── Status vocabularies (mirror schema.ts unions exactly) ─────────────────── */

export const SURVEY_STATUSES = ["draft", "submitted", "approved", "rejected"] as const
export type SurveyStatus = (typeof SURVEY_STATUSES)[number]

export const QC_STATUSES = ["pending", "approved", "rejected"] as const
export type QcStatus = (typeof QC_STATUSES)[number]

const PHOTO_SLOTS = ["front", "inside", "side", "document"] as const
export type PhotoSlot = (typeof PHOTO_SLOTS)[number]

const USER_ROLES = ["pending", "surveyor", "supervisor", "qc_supervisor", "admin"] as const
export type UserRole = (typeof USER_ROLES)[number]

const USER_STATUSES = ["pending_approval", "active", "disabled"] as const
export type UserStatus = (typeof USER_STATUSES)[number]

export const USER_ROLE_LABEL: Record<UserRole, string> = {
  pending: "Pending",
  surveyor: "Surveyor",
  supervisor: "Field Supervisor",
  qc_supervisor: "QC Supervisor",
  admin: "Administrator",
}

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  pending_approval: "Pending approval",
  active: "Active",
  disabled: "Disabled",
}

/** Master categories editable from the Masters module (brief list). */
export const MASTER_CATEGORIES = [
  "assessment_year",
  "ownership_type",
  "property_use_subcategory",
  "property_use",
  "situation",
  "road_type",
  "tax_rate_zone",
] as const
export type MasterCategory = (typeof MASTER_CATEGORIES)[number]

export const MASTER_CATEGORY_LABELS: Record<MasterCategory, string> = {
  assessment_year: "Assessment Year",
  ownership_type: "Ownership Type",
  property_use_subcategory: "Property Type",
  property_use: "Property Use",
  situation: "Situation",
  road_type: "Road Type",
  tax_rate_zone: "Tax Rate Zone",
}

/* ── Display helpers for the two status axes ──────────────────────────────── */

export const SURVEY_STATUS_LABEL: Record<SurveyStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
}

export const QC_STATUS_LABEL: Record<QcStatus, string> = {
  pending: "Pending QC",
  approved: "Approved",
  rejected: "Rejected",
}

/**
 * Tone token for status badges. NOTE the real backend nuance: a *rejected* QC
 * decision sends `survey.status` back to `draft` (so the surveyor can fix &
 * resubmit) while `qcStatus` becomes `rejected`. The UI should therefore key
 * the "rejected" visual off `qcStatus`, not `status`.
 */
const QC_STATUS_TONE: Record<QcStatus, "warning" | "success" | "destructive"> = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
}

const SURVEY_STATUS_TONE: Record<SurveyStatus, "muted" | "default" | "success" | "destructive"> = {
  draft: "muted",
  submitted: "default",
  approved: "success",
  rejected: "destructive",
}

export const PHOTO_SLOT_LABEL: Record<PhotoSlot, string> = {
  front: "Front",
  inside: "Inside",
  side: "Side",
  document: "Document",
}

/** Matches `survey.submit` — only draft (or legacy rejected status) surveys can be submitted. */
export function canSubmitSurvey(survey: { status: SurveyStatus }): boolean {
  return survey.status === "draft" || survey.status === "rejected"
}

/** QC rejection resets `status` to draft while `qcStatus` stays rejected. */
export function isSurveyResubmit(survey: { status: SurveyStatus; qcStatus: QcStatus }): boolean {
  return survey.status === "draft" && survey.qcStatus === "rejected"
}

/** In the QC queue — submitted and awaiting a supervisor decision. */
export function isSurveyAwaitingQc(survey: { status: SurveyStatus; qcStatus: QcStatus }): boolean {
  return survey.status === "submitted" && survey.qcStatus === "pending"
}

/** True when saves landed after the last submit (QC should re-check latest data). */
export function wasEditedAfterSubmit(survey: { submittedAt?: number; clientUpdatedAt: number }): boolean {
  return survey.submittedAt != null && survey.clientUpdatedAt > survey.submittedAt
}

/** Survey can be saved (draft, in QC queue, or returned — not approved/locked). */
function canSaveSurveyEdits(survey: { qcStatus: QcStatus }): boolean {
  return survey.qcStatus !== "approved"
}

/**
 * Show the QC "save corrections" bar instead of surveyor submit — survey stays in the QC queue.
 */
function needsQcSaveBar(survey: { status: SurveyStatus; qcStatus: QcStatus }): boolean {
  return isSurveyAwaitingQc(survey)
}

type EditCaps = {
  capabilities?: string[]
  role?: string
}

function hasCap(caps: string[] | undefined, role: string | undefined, key: Capability): boolean {
  if (caps && caps.length > 0) return caps.includes(key)
  return can(role as Role, key)
}

/** Whether the current user may open the survey/QC editor for this record. */
export function canUserEditSurvey(
  survey: { status: SurveyStatus; qcStatus: QcStatus },
  { capabilities, role }: EditCaps
): boolean {
  if (survey.qcStatus === "approved") {
    return role === "admin" || (capabilities?.includes("surveys.viewAll") ?? false)
  }
  if (isSurveyAwaitingQc(survey)) {
    return hasCap(capabilities, role, "qc.review") || role === "admin"
  }
  if (survey.status === "draft" || isSurveyResubmit(survey)) {
    return hasCap(capabilities, role, "surveys.editDraft")
  }
  return role === "admin"
}
