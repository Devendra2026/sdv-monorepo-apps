"use client"
/** Floor hooks — bound to floors.* (list/upsert/remove/reorder). */
import { useConvexAuthReady } from "@/hooks/use-convex-auth-ready"
import { api } from "@workspace/backend/convex/_generated/api.js"
import type { Id } from "@workspace/backend/convex/_generated/dataModel.js"
import { useMutation, useQuery } from "convex/react"

export function useFloors(surveyId: string | undefined) {
  const ready = useConvexAuthReady()
  return useQuery(api.floors.queries.list, ready && surveyId ? { surveyId: surveyId as Id<"surveys"> } : "skip")
}
export function useUpsertFloor() {
  return useMutation(api.floors.mutations.upsert)
}
export function useRemoveFloor() {
  return useMutation(api.floors.mutations.remove)
}
function useReorderFloors() {
  return useMutation(api.floors.mutations.reorder)
}
