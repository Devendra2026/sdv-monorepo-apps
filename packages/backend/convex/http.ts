/**
 * HTTP routes exposed by Convex.
 *
 * Setup:
 *   1. Get the URL: `npx convex env | grep CONVEX_SITE_URL`
 *      Public webhook URL is `<that URL>/clerk-webhook`.
 *   2. Clerk dashboard → Webhooks → add endpoint with the URL.
 *   3. `npx convex env set CLERK_WEBHOOK_SECRET whsec_xxx`
 *   4. ETL: `npx convex env set ETL_SECRET <shared-secret>`
 */
import { httpRouter } from "convex/server"
import { countSurveysHttp, getSurveyBundlesHttp, listSurveyIdsHttp, listWardCatalogHttp } from "./etl/http"
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

export default http
