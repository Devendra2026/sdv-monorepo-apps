/**
 * Safe alternatives to `.unique()` for indexes that are not uniqueness constraints.
 *
 * Convex indexes can return multiple rows for the same key after concurrent inserts.
 * `.unique()` throws in that case → UnhandledPromiseRejection inside Promise.all →
 * isolate restart on self-hosted Convex.
 */

export type CreationTimed = { _creationTime: number }

/** Prefer oldest document (matches survey localId keeper rule). */
export function pickOldest<T extends CreationTimed>(rows: T[]): T | null {
  if (rows.length === 0) return null
  return rows.reduce((a, b) => (a._creationTime <= b._creationTime ? a : b))
}

/** Prefer newest document (e.g. latest photo upload for a slot). */
export function pickNewest<T extends CreationTimed>(rows: T[]): T | null {
  if (rows.length === 0) return null
  return rows.reduce((a, b) => (a._creationTime >= b._creationTime ? a : b))
}

/**
 * From a small take() page, pick one keeper and return the rest as duplicates.
 * Never throws on duplicates.
 */
export function splitKeeperAndDuplicates<T extends CreationTimed>(
  rows: T[],
  prefer: "oldest" | "newest" = "oldest"
): { keeper: T | null; duplicates: T[] } {
  if (rows.length === 0) return { keeper: null, duplicates: [] }
  const keeper = prefer === "newest" ? pickNewest(rows) : pickOldest(rows)
  if (!keeper) return { keeper: null, duplicates: [] }
  const duplicates = rows.filter((r) => r !== keeper)
  return { keeper, duplicates }
}
