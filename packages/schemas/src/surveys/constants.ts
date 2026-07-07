/**
 * Survey domain constants shared between web, Convex validators, and Zod schemas.
 * Mirrors packages/backend/convex/lib/masters/* and schema.ts — keep in sync.
 */

export const RESPONDENT_RELATIONSHIP_VALUES = [
  "self",
  "father",
  "mother",
  "wife",
  "son",
  "daughter",
  "brother",
  "sister",
  "neighbour",
  "other",
] as const

export type RespondentRelationshipValue = (typeof RESPONDENT_RELATIONSHIP_VALUES)[number]

export const MAX_SURVEY_OWNERS = 10

export const PHOTO_SLOTS = ["front", "inside", "side", "document"] as const

export type PhotoSlotValue = (typeof PHOTO_SLOTS)[number]

export const WATER_SOURCE_VALUES = ["government_tap", "dug_well", "borewell", "other"] as const

export type WaterSourceValue = (typeof WATER_SOURCE_VALUES)[number]

export const SANITATION_TYPE_VALUES = ["sewer_system", "septic_tank", "surface_drain", "no_toilet", "other"] as const

export type SanitationTypeValue = (typeof SANITATION_TYPE_VALUES)[number]

export const SURVEY_STATUS_VALUES = ["draft", "submitted", "approved", "rejected"] as const

export type SurveyStatusValue = (typeof SURVEY_STATUS_VALUES)[number]

export const QC_STATUS_VALUES = ["pending", "approved", "rejected"] as const

export type QcStatusValue = (typeof QC_STATUS_VALUES)[number]
