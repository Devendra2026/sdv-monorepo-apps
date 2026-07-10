"use client"

import { useHasCapability } from "@/hooks/use-capability"
import { api } from "@workspace/backend/convex/_generated/api.js"
import type { Id } from "@workspace/backend/convex/_generated/dataModel.js"
import { useMutation, useQuery } from "convex/react"

export function useRoles(opts?: {
  includeInactive?: boolean
  requireCapability?: import("@/lib/permissions").Capability
}) {
  const capability = opts?.requireCapability ?? "roles.manage"
  const allowed = useHasCapability(capability)
  return useQuery(api.rbac.queries.listRoles, allowed ? { includeInactive: opts?.includeInactive } : "skip")
}

/** Roles for the Users page (filters + assignment) — available to users.view holders. */
export function useAssignableRoles(opts?: { includeInactive?: boolean }) {
  const allowed = useHasCapability("users.view")
  return useQuery(api.rbac.queries.listAssignableRoles, allowed ? { includeInactive: opts?.includeInactive } : "skip")
}

export function usePermissions() {
  const allowed = useHasCapability("roles.manage")
  return useQuery(api.rbac.queries.listPermissions, allowed ? {} : "skip")
}

export function useCreateRole() {
  return useMutation(api.rbac.mutations.createRole)
}

export function useUpdateRole() {
  return useMutation(api.rbac.mutations.updateRole).withOptimisticUpdate((localStore, args) => {
    for (const includeInactive of [true, false] as const) {
      const current = localStore.getQuery(api.rbac.queries.listRoles, { includeInactive })
      if (!current) continue
      localStore.setQuery(
        api.rbac.queries.listRoles,
        { includeInactive },
        current.map((role) => {
          if (role._id !== args.roleId) return role
          return {
            ...role,
            ...(args.name !== undefined ? { name: args.name } : {}),
            ...(args.description !== undefined ? { description: args.description } : {}),
            ...(args.isActive !== undefined ? { isActive: args.isActive } : {}),
            ...(args.permissionKeys !== undefined ? { permissionKeys: args.permissionKeys } : {}),
          }
        })
      )
    }
  })
}

export function useSeedRbac() {
  return useMutation(api.rbac.mutations.seedSystem)
}

export function useUserAllotments(userId: string | undefined) {
  const allowed = useHasCapability("users.view")
  return useQuery(api.allotments.queries.listForUser, allowed && userId ? { userId: userId as Id<"users"> } : "skip")
}

export function useSetUserAllotments() {
  return useMutation(api.allotments.mutations.setForUser)
}
