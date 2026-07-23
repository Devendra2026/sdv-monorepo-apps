/** 5-minute buckets so Convex query args stay stable across SSR + client hydration. */
export const NOW_MS_BUCKET = 300_000

/** Floor a clock to the shared Convex `nowMs` bucket. */
export function bucketNowMs(rawMs: number = Date.now()): number {
  return Math.floor(rawMs / NOW_MS_BUCKET) * NOW_MS_BUCKET
}
