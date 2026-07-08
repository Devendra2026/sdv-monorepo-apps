"use client"
/** Floor hooks — bound to floors.* (list/upsert/remove/reorder). */
import { useConvexAuthReady } from "@/hooks/use-convex-auth-ready"
import { api } from "@workspace/backend/convex/_generated/api.js"
import type { Id } from "@workspace/backend/convex/_generated/dataModel.js"
import { useMutation, useQuery } from "convex/react"
import type { FunctionArgs, FunctionReturnType } from "convex/server"

type FloorListRow = FunctionReturnType<typeof api.floors.queries.list>[number]
type UpsertFloorArgs = FunctionArgs<typeof api.floors.mutations.upsert>

function buildOptimisticFloorRow(args: UpsertFloorArgs, existing?: FloorListRow): FloorListRow {
  return {
    _id: existing?._id ?? (`temp_${args.clientFloorId}` as Id<"floors">),
    _creationTime: existing?._creationTime ?? Date.now(),
    surveyId: args.surveyId,
    clientFloorId: args.clientFloorId,
    position: args.position,
    floorName: args.floorName,
    usageFactor: args.usageFactor ?? existing?.usageFactor ?? "",
    usageType: args.usageType,
    constructionType: args.constructionType,
    isOccupied: args.isOccupied,
    areaSqft: args.areaSqft,
  }
}

function upsertFloorInList(list: FloorListRow[], row: FloorListRow): FloorListRow[] {
  const idx = list.findIndex((f) => f.clientFloorId === row.clientFloorId)
  const next = [...list]
  if (idx >= 0) next[idx] = row
  else next.push(row)
  return next.sort((a, b) => a.position - b.position)
}

export function useFloors(surveyId: string | undefined) {
  const ready = useConvexAuthReady()
  return useQuery(api.floors.queries.list, ready && surveyId ? { surveyId: surveyId as Id<"surveys"> } : "skip")
}

export function useUpsertFloor() {
  return useMutation(api.floors.mutations.upsert).withOptimisticUpdate((localStore, args) => {
    const surveyId = args.surveyId
    const list = localStore.getQuery(api.floors.queries.list, { surveyId })
    const existing = list?.find((f) => f.clientFloorId === args.clientFloorId)
    const optimisticRow = buildOptimisticFloorRow(args, existing)

    if (list) {
      localStore.setQuery(api.floors.queries.list, { surveyId }, upsertFloorInList(list, optimisticRow))
    }

    const survey = localStore.getQuery(api.surveys.queries.get, { id: surveyId })
    if (survey && Array.isArray(survey.floors)) {
      const surveyFloors = survey.floors as FloorListRow[]
      const existingSurveyFloor = surveyFloors.find((f) => f.clientFloorId === args.clientFloorId)
      const nextRow = buildOptimisticFloorRow(args, existingSurveyFloor ?? existing)
      localStore.setQuery(
        api.surveys.queries.get,
        { id: surveyId },
        {
          ...survey,
          floors: upsertFloorInList(surveyFloors, nextRow),
        }
      )
    }
  })
}

export function useRemoveFloor(surveyId: Id<"surveys"> | undefined) {
  return useMutation(api.floors.mutations.remove).withOptimisticUpdate((localStore, args) => {
    if (!surveyId) return

    const list = localStore.getQuery(api.floors.queries.list, { surveyId })
    if (list) {
      localStore.setQuery(
        api.floors.queries.list,
        { surveyId },
        list.filter((f) => f._id !== args.id)
      )
    }

    const survey = localStore.getQuery(api.surveys.queries.get, { id: surveyId })
    if (survey && Array.isArray(survey.floors)) {
      const surveyFloors = survey.floors as FloorListRow[]
      localStore.setQuery(
        api.surveys.queries.get,
        { id: surveyId },
        {
          ...survey,
          floors: surveyFloors.filter((f) => f._id !== args.id),
        }
      )
    }
  })
}
