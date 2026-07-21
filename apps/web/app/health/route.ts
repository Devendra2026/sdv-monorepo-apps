import { NextResponse } from "next/server"

/**
 * Liveness probe for Dokploy / Railpack / load balancers.
 *
 * Must stay fast: no Clerk, no Convex, no DB. Returns 200 whenever the
 * Next.js process can serve HTTP on :3000.
 */
export function GET() {
  return NextResponse.json(
    { ok: true, service: "web", ts: Date.now() },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  )
}
