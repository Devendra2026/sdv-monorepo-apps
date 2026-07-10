import { z } from "zod"

const convexIdSchema = <T extends string>() => z.string() as unknown as z.ZodType<string & { __tableName: T }>

/** QC feature schemas. */

export const qcDecisionSchema = z.enum(["approve", "reject"])

export type QcDecision = z.infer<typeof qcDecisionSchema>

export const QC_SECTION_VALUES = [
  "address",
  "property",
  "floors",
  "photos",
  "owner",
  "taxation",
  "services",
  "gis",
] as const

/** @deprecated Use `QC_SECTION_VALUES` */
export const QC_TAGGABLE_SECTIONS = QC_SECTION_VALUES

export const qcSectionSchema = z.enum(QC_SECTION_VALUES)

export type QcSection = z.infer<typeof qcSectionSchema>

export const qcRemarkWithAuthorSchema = z.object({
  _id: convexIdSchema<"qcRemarks">(),
  _creationTime: z.number(),
  surveyId: convexIdSchema<"surveys">(),
  message: z.string(),
  authorRole: z.string(),
  taggedSections: z.array(qcSectionSchema),
  status: z.enum(["open", "resolved"]),
  author: z
    .object({
      _id: convexIdSchema<"users">(),
      name: z.string(),
      role: z.string(),
    })
    .nullable(),
})

export type QcRemarkWithAuthor = z.infer<typeof qcRemarkWithAuthorSchema>
