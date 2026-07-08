"use client"
/** QC feature hooks — bound to qc.* (decide / addRemark / resolveRemark / reopen / listRemarks). */
import { useQcQuery } from "@/hooks/qc/convex/useQcQuery"
import { api } from "@workspace/backend/convex/_generated/api.js"
import type { Id } from "@workspace/backend/convex/_generated/dataModel.js"
import { useMutation } from "convex/react"

export function useQcRemarks(surveyId: string | undefined) {
  return useQcQuery(api.qc.queries.listRemarks, surveyId ? { surveyId: surveyId as Id<"surveys"> } : "skip")
}

/** Approve OR reject. decision='approve' → status+qcStatus approved.
 *  decision='reject' → qcStatus rejected, status back to 'draft' (re-editable). */
export function useDecide() {
  return useMutation(api.qc.mutations.decide)
}

/** "Request correction" = append an open remark; survey stays where it is. */
export function useAddRemark() {
  return useMutation(api.qc.mutations.addRemark)
}

export function useResolveRemark() {
  return useMutation(api.qc.mutations.resolveRemark)
}

/** Override / re-open an approved survey (admin or supervisor). */
export function useReopen() {
  return useMutation(api.qc.mutations.reopen)
}

export function useParcelSiblings(surveyId: string | undefined) {
  return useQcQuery(api.qc.queries.listParcelSiblings, surveyId ? { surveyId: surveyId as Id<"surveys"> } : "skip")
}

export function usePropertyIdConflicts(surveyId: string | undefined) {
  return useQcQuery(api.qc.queries.listPropertyIdConflicts, surveyId ? { surveyId: surveyId as Id<"surveys"> } : "skip")
}
