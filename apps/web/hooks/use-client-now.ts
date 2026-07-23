"use client"

import { bucketNowMs } from "@/lib/now-ms"
import { useMemo } from "react"

/** Stable client clock for Convex queries that need "today" boundaries. */
export function useClientNowMs(seedMs?: number): number {
  return useMemo(() => bucketNowMs(seedMs ?? Date.now()), [seedMs])
}
