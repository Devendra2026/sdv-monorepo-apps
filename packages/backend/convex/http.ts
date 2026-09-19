/**
 * HTTP routes exposed by Convex.
 *
 * Setup:
 *   1. Get the URL: `npx convex env | grep CONVEX_SITE_URL`
 *      Public webhook URL is `<that URL>/clerk-webhook`.
 *   2. Clerk dashboard → Webhooks → add endpoint with the URL.
 *   3. `npx convex env set CLERK_WEBHOOK_SECRET whsec_xxx`
 *   4. ETL: `npx convex env set ETL_SECRET <shared-secret>`
 *
 * ETL audit (production):
 *   Correct: POST `{CONVEX_SITE_URL}/etl/audit/list` with header `X-ETL-Secret`
 *   Wrong:   `/http/etl/audit/list` (not a Convex site path by default)
 *   Wrong:   API host (e.g. api.sdvedutech.in :3210) — HTTP actions are on the site host (:3211)
 *   Alias routes under `/http/etl/...` exist only for misconfigured clients; prefer the paths above.
 */
import { httpRouter } from "convex/server"
import {
  countSurveysHttp,
  getSurveyBundlesHttp,
  listAuditLogsHttp,
  listSurveyIdsHttp,
  listWardCatalogHttp,
  verifyAuditWindowHttp,
} from "./etl/http"
import { clerkWebhook } from "./http/clerkWebhook"

const http = httpRouter()

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: clerkWebhook,
})

http.route({
  path: "/etl/list-survey-ids",
  method: "POST",
  handler: listSurveyIdsHttp,
})

http.route({
  path: "/etl/get-survey-bundles",
  method: "POST",
  handler: getSurveyBundlesHttp,
})

http.route({
  path: "/etl/count-surveys",
  method: "POST",
  handler: countSurveysHttp,
})

http.route({
  path: "/etl/list-ward-catalog",
  method: "POST",
  handler: listWardCatalogHttp,
})

http.route({
  path: "/etl/audit/list",
  method: "POST",
  handler: listAuditLogsHttp,
})

http.route({
  path: "/etl/audit/verify-window",
  method: "POST",
  handler: verifyAuditWindowHttp,
})

/** Compat aliases — same handlers; clients that incorrectly prefix `/http` still resolve. */
http.route({
  path: "/http/etl/audit/list",
  method: "POST",
  handler: listAuditLogsHttp,
})

http.route({
  path: "/http/etl/audit/verify-window",
  method: "POST",
  handler: verifyAuditWindowHttp,
})

export default http
