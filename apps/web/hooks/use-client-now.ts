"use client"

import { useMemo } from "react"

/** 5-minute buckets so Convex query args stay stable across remounts / concurrent viewers. */
const NOW_MS_BUCKET = 300_000

/** Stable client clock for Convex queries that need "today" boundaries. */
export function useClientNowMs(seedMs?: number): number {
  return useMemo(() => {
    const raw = seedMs ?? Date.now()
    return Math.floor(raw / NOW_MS_BUCKET) * NOW_MS_BUCKET
  }, [seedMs])
}
