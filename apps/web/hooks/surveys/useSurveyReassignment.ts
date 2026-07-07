"use client";

import { api } from "@workspace/backend/convex/_generated/api.js";
import type { Id } from "@workspace/backend/convex/_generated/dataModel.js";
import { useHasCapability } from "@/hooks/use-capability";
import { useConvexAuthReady } from "@/hooks/use-convex-auth-ready";
import { useMutation, useQuery } from "convex/react";

export type DraftReassignFilters = {
  districtId?: string;
  municipalityId?: string;
  wardNo?: string;
};

export function useDraftOwners(filters: DraftReassignFilters = {}) {
  const ready = useConvexAuthReady();
  const allowed = useHasCapability("surveys.reassign");
  return useQuery(
    api.reassignment.queries.listDraftOwners,
    ready && allowed
      ? {
          districtId: filters.districtId as Id<"districts"> | undefined,
          municipalityId: filters.municipalityId as Id<"municipalities"> | undefined,
          wardNo: filters.wardNo,
        }
      : "skip",
  );
}

export function useReassignDrafts() {
  return useMutation(api.reassignment.mutations.reassignDrafts);
}
