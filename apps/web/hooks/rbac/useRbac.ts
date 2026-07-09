"use client";

import { api } from "@workspace/backend/convex/_generated/api.js";
import type { Id } from "@workspace/backend/convex/_generated/dataModel.js";
import { useHasCapability } from "@/hooks/use-capability";
import type { Capability } from "@/lib/permissions";
import { useMutation, useQuery } from "convex/react";

export function useRoles(opts?: { includeInactive?: boolean; requireCapability?: Capability }) {
  const capability = opts?.requireCapability ?? "roles.manage";
  const allowed = useHasCapability(capability);
  return useQuery(api.rbac.queries.listRoles, allowed ? { includeInactive: opts?.includeInactive } : "skip");
}

/** Roles for the Users page (filters + assignment) — available to users.view holders. */
export function useAssignableRoles(opts?: { includeInactive?: boolean }) {
  const allowed = useHasCapability("users.view");
  return useQuery(api.rbac.queries.listAssignableRoles, allowed ? { includeInactive: opts?.includeInactive } : "skip");
}

export function usePermissions() {
  const allowed = useHasCapability("roles.manage");
  return useQuery(api.rbac.queries.listPermissions, allowed ? {} : "skip");
}

export function useCreateRole() {
  return useMutation(api.rbac.mutations.createRole);
}

export function useUpdateRole() {
  return useMutation(api.rbac.mutations.updateRole);
}

export function useSeedRbac() {
  return useMutation(api.rbac.mutations.seedSystem);
}

export function useUserAllotments(userId: string | undefined) {
  const allowed = useHasCapability("users.view");
  return useQuery(api.allotments.queries.listForUser, allowed && userId ? { userId: userId as Id<"users"> } : "skip");
}

export function useSetUserAllotments() {
  return useMutation(api.allotments.mutations.setForUser);
}

function useToggleAllotment() {
  return useMutation(api.allotments.mutations.setActive);
}
