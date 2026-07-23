"use client"

import { useHasCapability } from "@/hooks/use-capability"
import { api } from "@workspace/backend/convex/_generated/api.js"
import type { Id } from "@workspace/backend/convex/_generated/dataModel.js"
import { useMutation, useQuery } from "convex/react"
import type { FunctionReturnType } from "convex/server"

export type TenantAdminTree = FunctionReturnType<typeof api.tenants.queries.listForAdmin>

export function useTenantAdmin(opts?: { enabled?: boolean }) {
  const allowed = useHasCapability("tenants.manage") && (opts?.enabled ?? true)
  return useQuery(api.tenants.queries.listForAdmin, allowed ? {} : "skip")
}

/** Lazy wards for one ULB — use when expanding tenant tree or assigning ward scope. */
export function useWardsForMunicipality(municipalityId: Id<"municipalities"> | undefined) {
  const allowed = useHasCapability("tenants.manage")
  return useQuery(api.tenants.queries.wardsForMunicipality, allowed && municipalityId ? { municipalityId } : "skip")
}

export function useUpsertDistrict() {
  return useMutation(api.tenants.mutations.upsertDistrict)
}

export function useUpsertMunicipality() {
  return useMutation(api.tenants.mutations.upsertMunicipality)
}

export function useUpsertWard() {
  return useMutation(api.tenants.mutations.upsertWard)
}
