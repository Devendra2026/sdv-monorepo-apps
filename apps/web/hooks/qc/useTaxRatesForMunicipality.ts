"use client"

import { useQcQuery } from "@/hooks/qc/convex/useQcQuery"
import { api } from "@workspace/backend/convex/_generated/api.js"
import type { Id } from "@workspace/backend/convex/_generated/dataModel.js"

/** Ward/ULB tax rates for demand notice — wraps Convex useQuery for reactive loading. */
export function useTaxRatesForMunicipality(municipalityId: Id<"municipalities"> | undefined) {
  const data = useQcQuery(api.taxation.queries.getForMunicipality, municipalityId ? { municipalityId } : "skip")

  return {
    rateConfig: data ?? undefined,
    ratesLoading: data === undefined,
    propertyTaxPct: data?.propertyTaxPct,
  }
}
