"use client"

import { useHasCapability } from "@/hooks/use-capability"
import { useConvexAuthReady } from "@/hooks/use-convex-auth-ready"
import type { Capability } from "@/lib/permissions"
import { useQuery } from "convex/react"
import type { FunctionReference } from "convex/server"

type QueryArgs<Query extends FunctionReference<"query">> = Query["_args"]

/**
 * Capability-gated Convex query for QC surfaces.
 * Pair with `RoleGate` on the page — hooks must skip when the user lacks access.
 */
export function useQcQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: QueryArgs<Query> | "skip",
  capability: Capability = "qc.review"
) {
  const ready = useConvexAuthReady()
  const allowed = useHasCapability(capability)
  const resolvedArgs = ready && allowed && args !== "skip" ? args : "skip"
  return useQuery(query, resolvedArgs as QueryArgs<Query> | "skip")
}
