"use client"

import { useHasCapability } from "@/hooks/use-capability"
import { useCursorPagination } from "@/hooks/use-cursor-pagination"
import { api } from "@workspace/backend/convex/_generated/api.js"
import { useQuery as useConvexQuery, useMutation } from "convex/react"
import { useMemo } from "react"

export function usePendingApprovals() {
  const allowed = useHasCapability("users.approve")
  return useConvexQuery(api.admin.queries.listPendingApprovals, allowed ? {} : "skip")
}

export type UserListFilters = {
  role?: string
  status?: "pending_approval" | "active" | "disabled"
}

export function useUserListPaginated(filters: UserListFilters = {}, pageSize = 15) {
  const allowed = useHasCapability("users.view")
  const resetKey = `${filters.role ?? ""}|${filters.status ?? ""}`
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
    api.admin.queries.listUsers,
    allowed ? { paginationOpts: { numItems: size, cursor }, role: filters.role, status: filters.status } : "skip"
  )

  const users = result?.page
  const canGoNext = result ? !result.isDone : false

  return useMemo(
    () => ({
      users,
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
    [users, result, pageNumber, pageIndex, size, canGoPrev, canGoNext, goNext, goPrev]
  )
}

export function useApproveUser() {
  return useMutation(api.admin.mutations.approveUser)
}
export function useRejectUser() {
  return useMutation(api.admin.mutations.rejectUser)
}
export function useAssignTenant() {
  return useMutation(api.admin.mutations.assignTenant)
}
export function useUpdateUser() {
  return useMutation(api.admin.mutations.updateUser)
}
/** Catalog of districts/ULBs/wards for the approval & assignment forms. */
export function useTenantCatalog() {
  const allowed = useHasCapability("users.assignTenant")
  return useConvexQuery(api.tenants.queries.listForAdmin, allowed ? {} : "skip")
}
