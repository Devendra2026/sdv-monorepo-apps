"use client"
/** Master-data admin hooks — bound to admin.upsertMaster / admin.deleteMaster. */
import { useHasCapability } from "@/hooks/use-capability"
import { api } from "@workspace/backend/convex/_generated/api.js"
import { useMutation, useQuery } from "convex/react"

export function useUpsertMaster() {
  return useMutation(api.admin.mutations.upsertMaster).withOptimisticUpdate((localStore, args) => {
    const current = localStore.getQuery(api.masters.queries.listByCategory, { category: args.category })
    if (!current) return
    localStore.setQuery(
      api.masters.queries.listByCategory,
      { category: args.category },
      current.map((row) =>
        row.value === args.value
          ? {
              ...row,
              label: args.label,
              position: args.position,
              isActive: args.isActive,
            }
          : row
      )
    )
  })
}

export function useDeleteMaster() {
  return useMutation(api.admin.mutations.deleteMaster)
}

/** Raw rows for one category (incl. inactive + position) — additive admin read. */
export function useMasterCategory(category: string | undefined) {
  const allowed = useHasCapability("masters.manage")
  return useQuery(api.masters.queries.listByCategory, allowed && category ? { category } : "skip")
}
