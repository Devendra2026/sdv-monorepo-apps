/**
 * ETL HTTP endpoints — authenticated with X-ETL-Secret (Convex env ETL_SECRET).
 */
import { internal } from "../_generated/api"
import { httpAction } from "../_generated/server"
import {
  DEFAULT_AUDIT_ETL_PAGE,
  DEFAULT_ETL_PAGE,
  MAX_AUDIT_ETL_PAGE,
  MAX_ETL_BUNDLE_IDS,
  MAX_ETL_PAGE,
  sanitizeStatuses,
} from "./queries"

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

/**
 * Short, non-reversible label for a secret, safe to log and to return to the
 * caller. 48 bits identifies a mismatch while revealing nothing usable; the
 * comparison itself always uses the full digest.
 */
function fingerprintOf(digestHex: string, value: string): string {
  return value === "" ? "empty" : digestHex.slice(0, 12)
}

/** Compares equal-length hex digests without leaking match position via timing. */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/**
 * Both sides trim: `ETL_SECRET` is often set by pasting or piping a value, which
 * silently appends a newline that would otherwise cause a permanent 401 between
 * two secrets that look identical in every dashboard.
 */
async function assertEtlSecret(request: Request): Promise<Response | null> {
  const expected = process.env.ETL_SECRET?.trim() ?? ""
  if (!expected) {
    console.error("ETL_SECRET not configured")
    return new Response(JSON.stringify({ error: "Server misconfigured", reason: "secret_not_configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  const provided = (request.headers.get("X-ETL-Secret") ?? "").trim()
  const [expectedDigest, providedDigest] = await Promise.all([sha256Hex(expected), sha256Hex(provided)])

  if (!constantTimeEquals(expectedDigest, providedDigest)) {
    const expectedFingerprint = fingerprintOf(expectedDigest, expected)
    const providedFingerprint = fingerprintOf(providedDigest, provided)
    console.error(
      JSON.stringify({
        msg: "etl_auth_rejected",
        reason: provided === "" ? "secret_missing" : "secret_mismatch",
        expectedFingerprint,
        providedFingerprint,
      })
    )
    // The caller only learns a hash of what it already sent, so echoing the
    // fingerprint back lets the ETL preflight distinguish a genuine mismatch
    // from a proxy that stripped or rewrote the header.
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        reason: provided === "" ? "secret_missing" : "secret_mismatch",
        providedFingerprint,
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    )
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
  const denied = await assertEtlSecret(request)
  if (denied) return denied

  const body = (await readJsonBody(request)) as {
    cursor?: string | null
    numItems?: number
    status?: "draft" | "submitted" | "approved" | "rejected"
    statuses?: unknown
  }

  const numItems = Math.min(Math.max(1, body.numItems ?? DEFAULT_ETL_PAGE), MAX_ETL_PAGE)
  const result = await ctx.runQuery(internal.etl.queries.listSurveyIds, {
    paginationOpts: {
      numItems,
      cursor: body.cursor ?? null,
    },
    status: body.status,
    statuses: sanitizeStatuses(body.statuses),
  })
  return json(result)
})

export const getSurveyBundlesHttp = httpAction(async (ctx, request) => {
  const denied = await assertEtlSecret(request)
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
  const denied = await assertEtlSecret(request)
  if (denied) return denied

  // Counting the same statuses the caller imports is what makes the ETL
  // validation delta meaningful; an unfiltered total always looks short by the
  // number of drafts and reads as permanent data loss.
  const body = (await readJsonBody(request)) as { statuses?: unknown }
  const statuses = sanitizeStatuses(body.statuses)

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
        statuses,
      }
    )
    count += page.ids.length
    cursor = page.continueCursor
    isDone = page.isDone
  }
  return json({ count, statuses: statuses ?? null })
})

export const listWardCatalogHttp = httpAction(async (ctx, request) => {
  const denied = await assertEtlSecret(request)
  if (denied) return denied
  const wards = await ctx.runQuery(internal.etl.queries.listWardCatalog, {})
  return json({ wards })
})

export const listAuditLogsHttp = httpAction(async (ctx, request) => {
  const denied = await assertEtlSecret(request)
  if (denied) return denied

  const body = (await readJsonBody(request)) as {
    lastCreationTime?: number
    lastId?: string
    limit?: number
  }

  const lastCreationTime =
    typeof body.lastCreationTime === "number" && Number.isFinite(body.lastCreationTime)
      ? body.lastCreationTime
      : 0
  const lastId = typeof body.lastId === "string" ? body.lastId : ""
  const limit = Math.min(
    Math.max(1, body.limit ?? DEFAULT_AUDIT_ETL_PAGE),
    MAX_AUDIT_ETL_PAGE
  )

  const result = await ctx.runQuery(internal.etl.queries.listAuditLogs, {
    lastCreationTime,
    lastId,
    limit,
  })
  return json(result)
})

export const verifyAuditWindowHttp = httpAction(async (ctx, request) => {
  const denied = await assertEtlSecret(request)
  if (denied) return denied

  const body = (await readJsonBody(request)) as {
    windowStartMs?: number
    windowEndMs?: number
  }

  if (
    typeof body.windowStartMs !== "number" ||
    typeof body.windowEndMs !== "number" ||
    !Number.isFinite(body.windowStartMs) ||
    !Number.isFinite(body.windowEndMs) ||
    body.windowEndMs <= body.windowStartMs
  ) {
    return json({ error: "windowStartMs and windowEndMs required (end > start)" }, 400)
  }

  const ids: string[] = []
  let lastCreationTime = body.windowStartMs
  let lastId = ""
  let isDone = false

  while (!isDone) {
    const page: {
      ids: string[]
      isDone: boolean
      nextCreationTime: number | null
      nextId: string | null
    } = await ctx.runQuery(internal.etl.queries.listAuditIdsInWindow, {
      windowStartMs: body.windowStartMs,
      windowEndMs: body.windowEndMs,
      lastCreationTime,
      lastId,
      limit: MAX_AUDIT_ETL_PAGE,
    })
    ids.push(...page.ids)
    if (page.isDone || page.ids.length === 0 || page.nextCreationTime === null || page.nextId === null) {
      isDone = true
    } else {
      lastCreationTime = page.nextCreationTime
      lastId = page.nextId
    }
  }

  ids.sort()
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ids.join("\n")))
  const checksum = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")

  return json({
    windowStartMs: body.windowStartMs,
    windowEndMs: body.windowEndMs,
    count: ids.length,
    checksum,
  })
})
