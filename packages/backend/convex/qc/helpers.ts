import { v } from "convex/values"
import { qcStatus, surveyStatus } from "../schema"

export const COMMAND_CENTER_WARD_SCAN_LIMIT = 2500

export const wardStatsEntryShape = {
  wardNo: v.string(),
  municipalityId: v.id("municipalities"),
  city: v.string(),
  pending: v.number(),
  approved: v.number(),
  rejected: v.number(),
  drafts: v.number(),
  total: v.number(),
  qcCompletionPct: v.number(),
  firstPendingId: v.optional(v.id("surveys")),
}

export const commandCenterStatsShape = {
  pending: v.number(),
  approved: v.number(),
  rejected: v.number(),
  drafts: v.number(),
  submittedToday: v.number(),
  submitted: v.number(),
  qcCompletionPct: v.number(),
  wardStats: v.array(v.object(wardStatsEntryShape)),
}

export const parcelSiblingEntry = v.object({
  _id: v.id("surveys"),
  propertyId: v.optional(v.string()),
  propertyUse: v.string(),
  unitNo: v.string(),
  wardNo: v.string(),
  parcelNo: v.string(),
  respondentName: v.optional(v.string()),
  qcStatus,
  status: surveyStatus,
  surveyorName: v.optional(v.string()),
})

export function wardNumbersMatch(rowWard: string, filterWard: string): boolean {
  if (rowWard === filterWard) return true
  const a = Number(rowWard)
  const b = Number(filterWard)
  return !Number.isNaN(a) && !Number.isNaN(b) && a === b
}
