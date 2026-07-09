"use client"

import { useHasCapability } from "@/hooks/use-capability"
import { api } from "@workspace/backend/convex/_generated/api.js"
import { useMutation, useQuery } from "convex/react"

export function useTenantAdmin() {
  const allowed = useHasCapability("masters.manage")
  return useQuery(api.tenants.queries.listForAdmin, allowed ? {} : "skip")
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
