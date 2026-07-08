import { z } from "zod";

import type { Id } from "@workspace/backend/convex/_generated/dataModel";

/** QC feature schemas. */

export const qcDecisionSchema = z.enum(["approve", "reject"]);

export type QcDecision = z.infer<typeof qcDecisionSchema>;

export const QC_TAGGABLE_SECTIONS = [
  "property",
  "owner",
  "address",
  "taxation",
  "floors",
  "services",
  "gis",
  "photos",
] as const;

export const qcSectionSchema = z.enum(QC_TAGGABLE_SECTIONS);

export type QcSection = z.infer<typeof qcSectionSchema>;

export const qcRemarkWithAuthorSchema = z.object({
  _id: z.custom<Id<"qcRemarks">>(),
  _creationTime: z.number(),
  surveyId: z.custom<Id<"surveys">>(),
  message: z.string(),
  authorRole: z.string(),
  taggedSections: z.array(qcSectionSchema),
  status: z.enum(["open", "resolved"]),
  author: z
    .object({
      _id: z.custom<Id<"users">>(),
      name: z.string(),
      role: z.string(),
    })
    .nullable(),
});

export type QcRemarkWithAuthor = z.infer<
  typeof qcRemarkWithAuthorSchema
>;
