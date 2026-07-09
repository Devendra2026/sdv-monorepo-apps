"use client"
/** Audit hooks — bound to the additive audit.* read queries. */
import { useHasCapability } from "@/hooks/use-capability"
import { useClientNowMs } from "@/hooks/use-client-now"
import { useCursorPagination } from "@/hooks/use-cursor-pagination"
import { api } from "@workspace/backend/convex/_generated/api.js"
import type { Id } from "@workspace/backend/convex/_generated/dataModel.js"
import { useQuery as useConvexQuery } from "convex/react"
import { useMemo } from "react"

export type AuditFilterFacets = {
  actions: string[]
  entities: string[]
}

/** Supports legacy deployments that returned `string[]` before facets were combined. */
function normalizeFacets(raw: string[] | AuditFilterFacets | undefined): AuditFilterFacets | undefined {
  if (raw === undefined) return undefined
  if (Array.isArray(raw)) return { actions: raw, entities: [] }
  return raw
}

export function useAuditLog(
  filters: { entity?: string; entityId?: string; actorId?: string; action?: string; limit?: number } = {}
) {
  const allowed = useHasCapability("audit.view")
  return useConvexQuery(
    api.audit.queries.list,
    allowed
      ? {
          entity: filters.entity,
          entityId: filters.entityId,
          actorId: filters.actorId as Id<"users"> | undefined,
          action: filters.action,
          limit: filters.limit ?? 100,
        }
      : "skip"
  )
}

export type AuditListFilters = {
  entity?: string
  action?: string
}

export function useAuditLogPaginated(filters: AuditListFilters = {}, pageSize = 15) {
  const allowed = useHasCapability("audit.view")
  const resetKey = `${filters.action ?? ""}|${filters.entity ?? ""}`
  const {
    cursor,
    pageIndex,
    pageSize: size,
    canGoPrev,
    goNext,
    goPrev,
    pageNumber,
  } = useCursorPagination(resetKey, pageSize)

  const result = useConvexQuery(
    api.audit.queries.listPaginated,
    allowed
      ? {
          paginationOpts: { numItems: size, cursor },
          entity: filters.entity,
          action: filters.action,
        }
      : "skip"
  )

  const rows = result?.page
  const canGoNext = result ? !result.isDone : false

  return useMemo(
    () => ({
      rows,
      isLoading: result === undefined,
      pageNumber,
      pageIndex,
      pageSize: size,
      canGoPrev,
      canGoNext,
      goNext: () => {
        if (result) goNext(result.continueCursor, result.isDone)
      },
      goPrev,
    }),
    [rows, result, pageNumber, pageIndex, size, canGoPrev, canGoNext, goNext, goPrev]
  )
}

export function useAuditFacets() {
  const allowed = useHasCapability("audit.view")
  const raw = useConvexQuery(api.audit.queries.actionFacets, allowed ? {} : "skip")
  return useMemo(() => normalizeFacets(raw), [raw])
}

export function useAuditSummary() {
  const allowed = useHasCapability("audit.view")
  const nowMs = useClientNowMs()
  return useConvexQuery(api.audit.queries.summary, allowed ? { nowMs } : "skip")
}
