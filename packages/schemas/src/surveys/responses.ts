import { z } from "zod"

import { qcSectionSchema } from "../qc/index"
import { PHOTO_SLOTS, QC_STATUS_VALUES, SURVEY_STATUS_VALUES } from "./constants"

const convexIdSchema = <T extends string>() => z.string() as unknown as z.ZodType<string & { __tableName: T }>

export const surveyStatusSchema = z.enum(SURVEY_STATUS_VALUES)

export const qcStatusSchema = z.enum(QC_STATUS_VALUES)

export const photoSlotSchema = z.enum(PHOTO_SLOTS)

/** Loose owner shape returned from Convex API responses. */
export const ownerEntryResponseSchema = z.object({
  name: z.string().optional(),
  fatherOrHusbandName: z.string().optional(),
  mobileNo: z.string().optional(),
  altMobileNo: z.string().optional(),
})

export type OwnerEntry = z.infer<typeof ownerEntryResponseSchema>

export const gpsCaptureSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  accuracyMeters: z.number(),
  capturedAt: z.number(),
  provider: z.string().optional(),
  isMockLocation: z.boolean().optional(),
})

export type GpsCapture = z.infer<typeof gpsCaptureSchema>

export const surveyListItemSchema = z.object({
  _id: convexIdSchema<"surveys">(),
  _creationTime: z.number(),
  localId: z.string(),
  surveyorId: convexIdSchema<"users">(),
  districtId: convexIdSchema<"districts">(),
  municipalityId: convexIdSchema<"municipalities">(),
  wardNo: z.string(),
  status: surveyStatusSchema,
  qcStatus: qcStatusSchema,
  serverVersion: z.number(),
  submittedAt: z.number().optional(),
  propertyId: z.string().optional(),
  parcelNo: z.string(),
  unitNo: z.string(),
  respondentName: z.string().optional(),
  owners: z.array(ownerEntryResponseSchema).optional(),
  mobileNo: z.string(),
  locality: z.string(),
  colonyName: z.string(),
  city: z.string(),
  pinCode: z.string(),
  assessmentYear: z.string(),
  ownershipType: z.string(),
  propertyType: z.string(),
  propertyUse: z.string(),
  situation: z.string(),
  roadType: z.string(),
  taxRateZone: z.string(),
  plotSqft: z.number(),
  plinthSqft: z.number(),
  isSlum: z.boolean(),
  municipalWaterConnection: z.boolean(),
  waterSource: z.string(),
  sanitationType: z.string(),
  municipalWasteCollection: z.boolean(),
  electricityNo: z.string().optional(),
  sectorNo: z.string().optional(),
  oldPropertyNo: z.string().optional(),
  constructedYear: z.number().optional(),
  familySize: z.number().optional(),
  relationship: z.string().optional(),
  altMobileNo: z.string().optional(),
  houseNo: z.string().optional(),
  gps: gpsCaptureSchema.optional(),
})

export type SurveyListItem = z.infer<typeof surveyListItemSchema>

export const floorRowSchema = z.object({
  _id: convexIdSchema<"floors">(),
  surveyId: convexIdSchema<"surveys">(),
  clientFloorId: z.string(),
  position: z.number(),
  floorName: z.string(),
  usageFactor: z.string().optional(),
  usageType: z.string(),
  constructionType: z.string(),
  isOccupied: z.boolean(),
  areaSqft: z.number(),
})

export type FloorRow = z.infer<typeof floorRowSchema>

export const photoRowSchema = z.object({
  _id: convexIdSchema<"photos">(),
  surveyId: convexIdSchema<"surveys">(),
  slot: photoSlotSchema,
  storageId: convexIdSchema<"_storage">(),
  sizeKb: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  capturedAt: z.number(),
  uploadedBy: convexIdSchema<"users">(),
  url: z.string().nullable(),
})

export type PhotoRow = z.infer<typeof photoRowSchema>

export const surveyRemarkSchema = z.object({
  _id: convexIdSchema<"qcRemarks">(),
  _creationTime: z.number(),
  message: z.string(),
  authorRole: z.string(),
  taggedSections: z.array(qcSectionSchema),
  status: z.enum(["open", "resolved"]),
})

export type SurveyRemark = z.infer<typeof surveyRemarkSchema>

export const surveyorSummarySchema = z.object({
  _id: convexIdSchema<"users">(),
  name: z.string(),
})

export const surveyDetailSchema = surveyListItemSchema.extend({
  floors: z.array(floorRowSchema),
  photos: z.array(photoRowSchema),
  qcRemarks: z.array(surveyRemarkSchema),
  surveyor: surveyorSummarySchema.nullable(),
})

export type SurveyDetail = z.infer<typeof surveyDetailSchema>
