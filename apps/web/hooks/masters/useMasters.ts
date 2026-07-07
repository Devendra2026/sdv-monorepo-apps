"use client";

/**
 * useMasters — the live, admin-editable dropdown catalog from
 * `api.masters.bundle`. This is the single source of truth for every <Select>
 * across the survey forms (assessment years, ownership types, property uses,
 * road types, situations, tax zones, water/sanitation, floor masters) PLUS the
 * tenant catalog (districts / ULBs / wards) scoped to the caller.
 *
 * Reactive: when an admin edits a master in the Masters module (which calls
 * `admin.upsertMaster`), Convex pushes the change and every open form updates.
 */
import { api } from "@workspace/backend/convex/_generated/api.js";
import { useConvexAuthReady } from "@/hooks/use-convex-auth-ready";
import { useQuery as useConvexQuery } from "convex/react";

export function useMasters(opts?: { includeTenantCatalog?: boolean }) {
  const ready = useConvexAuthReady();
  const bundle = useConvexQuery(
    api.masters.queries.bundle,
    ready ? { includeWards: false, includeTenantCatalog: opts?.includeTenantCatalog ?? true } : "skip",
  );
  return { masters: bundle, isLoading: bundle === undefined };
}

export function useWardsForMunicipality(municipalityId: string | undefined) {
  const ready = useConvexAuthReady();
  return useConvexQuery(
    api.masters.queries.wardsForMunicipality,
    ready && municipalityId ? { municipalityId: municipalityId as any } : "skip",
  );
}
