import { z } from "zod"

import {
  MAX_SURVEY_OWNERS,
  RESPONDENT_RELATIONSHIP_VALUES,
  SANITATION_TYPE_VALUES,
  WATER_SOURCE_VALUES,
} from "./constants"

export const indianMobileSchema = z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile (starts 6-9)")

export const optionalIndianMobileSchema = z.union([indianMobileSchema, z.literal("")]).optional()

/** Strict owner row validation for form input. */
export const ownerEntryInputSchema = z.object({
  name: z.string().trim().optional(),
  fatherOrHusbandName: z.string().trim().optional(),
  mobileNo: optionalIndianMobileSchema,
  altMobileNo: optionalIndianMobileSchema,
})

export type OwnerEntryInput = z.infer<typeof ownerEntryInputSchema>

const currentYear = new Date().getFullYear()

export const surveySubmitBaseSchema = z.object({
  localId: z.string().min(1),
  municipalityId: z.string().min(1, "Select a ULB"),
  wardNo: z.string().min(1, "Ward is required"),
  sectorNo: z.string().trim().optional(),
  oldPropertyNo: z.string().trim().optional(),
  propertyId: z.string().trim().optional(),
  parcelNo: z.string().trim().min(1, "Parcel number is required"),
  unitNo: z.string().trim().min(1, "Unit number is required"),
  constructedYear: z
    .number()
    .int()
    .min(1800, `Enter a year between 1800 and ${currentYear}`)
    .max(currentYear, `Enter a year between 1800 and ${currentYear}`)
    .optional(),
  isSlum: z.boolean(),
  respondentName: z.string().trim().optional(),
  relationship: z.enum(RESPONDENT_RELATIONSHIP_VALUES).optional(),
  owners: z.array(ownerEntryInputSchema).max(MAX_SURVEY_OWNERS).optional(),
  familySize: z.number().int().min(1, "Family size must be a whole number ≥ 1").optional(),
  mobileNo: indianMobileSchema,
  altMobileNo: optionalIndianMobileSchema,
  houseNo: z.string().trim().optional(),
  locality: z.string().trim().min(1, "Locality is required"),
  colonyName: z.string().trim().min(1, "Colony name is required"),
  city: z.string().trim().min(1, "City is required"),
  pinCode: z.string().regex(/^\d{6}$/, "PIN code must be 6 digits"),
  assessmentYear: z.string().min(1, "Assessment year is required"),
  ownershipType: z.string().min(1, "Ownership type is required"),
  propertyUse: z.string().min(1, "Property use is required"),
  propertyType: z.string().min(1, "Property type is required"),
  situation: z.string().min(1, "Situation is required"),
  roadType: z.string().min(1, "Road type is required"),
  taxRateZone: z.string().min(1, "Tax rate zone is required"),
  plotSqft: z.number().nonnegative(),
  plinthSqft: z.number().nonnegative(),
  municipalWaterConnection: z.boolean(),
  waterSource: z.enum(WATER_SOURCE_VALUES),
  sanitationType: z.enum(SANITATION_TYPE_VALUES),
  municipalWasteCollection: z.boolean(),
  electricityNo: z.string().trim().optional(),
  clientUpdatedAt: z.number(),
})

export const surveySubmitSchema = surveySubmitBaseSchema.refine(
  (values) => !(values.plotSqft > 0 && values.plinthSqft > values.plotSqft),
  {
    message: "Plinth area cannot exceed plot area",
    path: ["plinthSqft"],
  }
)

export type SurveySubmitValues = z.infer<typeof surveySubmitSchema>

export const surveyDraftSchema = surveySubmitBaseSchema.partial().extend({
  localId: z.string().min(1),
  municipalityId: z.string().min(1, "Select a ULB"),
  clientUpdatedAt: z.number(),
})

export type SurveyDraftValues = z.infer<typeof surveyDraftSchema>

/** @deprecated Use ownerEntryInputSchema */
export const ownerEntrySchema = ownerEntryInputSchema

/** @deprecated Use OwnerEntryInput */
export type OwnerEntryValues = OwnerEntryInput

export const floorSchema = z.object({
  clientFloorId: z.string().min(1),
  position: z.number().int().nonnegative(),
  floorName: z.string().min(1, "Floor is required"),
  usageFactor: z.string().optional(),
  usageType: z.string().min(1, "Usage type is required"),
  constructionType: z.string().min(1, "Construction type is required"),
  isOccupied: z.boolean(),
  areaSqft: z.number().nonnegative(),
})

export type FloorValues = z.infer<typeof floorSchema>
