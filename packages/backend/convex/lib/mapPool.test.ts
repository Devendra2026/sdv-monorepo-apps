import { describe, expect, it } from "vitest"
import { mapInChunks, mapPool } from "./mapPool"

describe("mapInChunks", () => {
  it("preserves order and runs all items", async () => {
    const items = [1, 2, 3, 4, 5]
    const seenConcurrency: number[] = []
    let inFlight = 0

    const results = await mapInChunks(items, 2, async (n) => {
      inFlight += 1
      seenConcurrency.push(inFlight)
      await Promise.resolve()
      inFlight -= 1
      return n * 10
    })

    expect(results).toEqual([10, 20, 30, 40, 50])
    expect(Math.max(...seenConcurrency)).toBeLessThanOrEqual(2)
  })

  it("returns empty for empty input", async () => {
    expect(await mapInChunks([], 12, async (x) => x)).toEqual([])
  })
})

describe("mapPool", () => {
  it("preserves order under concurrency", async () => {
    const results = await mapPool([1, 2, 3], 2, async (n) => n + 1)
    expect(results).toEqual([2, 3, 4])
  })
})
