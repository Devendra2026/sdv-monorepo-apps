/**
 * Run async work over items with a fixed concurrency limit.
 * Prefer this over unbounded Promise.all for DB/storage fan-out.
 */
export async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []
  const limit = Math.max(1, Math.min(concurrency, items.length))
  const results = new Array<R>(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(items[index]!, index)
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()))
  return results
}

/**
 * Run async work in sequential chunks (hard barrier between chunks).
 * Use for multi-ULB indexed queries where unbounded Promise.all saturates
 * queryStreamNext / syscall duration budgets on self-hosted Convex.
 * Same documents are read; only concurrency is bounded.
 */
export async function mapInChunks<T, R>(
  items: readonly T[],
  chunkSize: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []
  const size = Math.max(1, chunkSize)
  const results: R[] = []
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size)
    const chunkResults = await Promise.all(chunk.map((item, j) => mapper(item, i + j)))
    results.push(...chunkResults)
  }
  return results
}
