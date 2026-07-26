/**
 * ETL HTTP endpoints — authenticated with X-ETL-Secret (Convex env ETL_SECRET).
 */
import { internal } from "../_generated/api"
import { httpAction } from "../_generated/server"
import type { Id } from "../_generated/dataModel"
import { DEFAULT_ETL_PAGE, MAX_ETL_BUNDLE_IDS, MAX_ETL_PAGE } from "./queries"

function assertEtlSecret(request: Request): Response | null {
  const expected = process.env.ETL_SECRET
  if (!expected) {
    console.error("ETL_SECRET not configured")
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
  const provided = request.headers.get("X-ETL-Secret") ?? ""
  if (provided !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }
  return null
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

export const listSurveyIdsHttp = httpAction(async (ctx, request) => {
  const denied = assertEtlSecret(request)
  if (denied) return denied

  const body = (await readJsonBody(request)) as {
    cursor?: string | null
    numItems?: number
    status?: "draft" | "submitted" | "approved" | "rejected"
  }

  const numItems = Math.min(Math.max(1, body.numItems ?? DEFAULT_ETL_PAGE), MAX_ETL_PAGE)
  const result = await ctx.runQuery(internal.etl.queries.listSurveyIds, {
    paginationOpts: {
      numItems,
      cursor: body.cursor ?? null,
    },
    status: body.status,
  })
  return json(result)
})

export const getSurveyBundlesHttp = httpAction(async (ctx, request) => {
  const denied = assertEtlSecret(request)
  if (denied) return denied

  const body = (await readJsonBody(request)) as { ids?: string[] }
  const ids = Array.isArray(body.ids) ? body.ids : []
  if (ids.length === 0) return json({ bundles: [] })
  if (ids.length > MAX_ETL_BUNDLE_IDS) {
    return json({ error: `Max ${MAX_ETL_BUNDLE_IDS} ids per request` }, 400)
  }

  const result = await ctx.runQuery(internal.etl.queries.getSurveyBundles, {
    ids,
  })
  return json(result)
})

export const countSurveysHttp = httpAction(async (ctx, request) => {
  const denied = assertEtlSecret(request)
  if (denied) return denied

  let count = 0
  let cursor: string | null = null
  let isDone = false
  while (!isDone) {
    const page: { ids: string[]; continueCursor: string; isDone: boolean } = await ctx.runQuery(
      internal.etl.queries.listSurveyIds,
      {
        paginationOpts: {
          numItems: MAX_ETL_PAGE,
          cursor,
        },
      }
    )
    count += page.ids.length
    cursor = page.continueCursor
    isDone = page.isDone
  }
  return json({ count })
})
