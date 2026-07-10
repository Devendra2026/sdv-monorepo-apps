"use client"

import { useMemo } from "react"

/** Stable client clock for Convex queries that need "today" boundaries. */
export function useClientNowMs(seedMs?: number): number {
  return useMemo(() => seedMs ?? Date.now(), [seedMs])
}
