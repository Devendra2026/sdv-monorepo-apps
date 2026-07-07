"use client";

import { api } from "@workspace/backend/convex/_generated/api.js";
import { useHasCapability } from "@/hooks/use-capability";
import { useMutation, useQuery } from "convex/react";

export function useTenantAdmin() {
  const allowed = useHasCapability("masters.manage");
  return useQuery(api.tenants.listForAdmin, allowed ? {} : "skip");
}

export function useUpsertDistrict() {
  return useMutation(api.tenants.upsertDistrict);
}

export function useUpsertMunicipality() {
  return useMutation(api.tenants.upsertMunicipality);
}

export function useUpsertWard() {
  return useMutation(api.tenants.upsertWard);
}
