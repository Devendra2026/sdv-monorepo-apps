import { classifyAuthHang } from "@/hooks/use-convex-auth-ready"
import { describe, expect, it } from "vitest"

describe("classifyAuthHang", () => {
  it("reports clerk when Clerk has not finished loading", () => {
    expect(classifyAuthHang(false)).toBe("clerk")
  })

  it("reports convex_ws when Clerk is loaded but Convex auth still hangs", () => {
    expect(classifyAuthHang(true)).toBe("convex_ws")
  })
})
