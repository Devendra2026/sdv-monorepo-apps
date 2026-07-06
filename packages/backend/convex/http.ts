/**
 * HTTP routes exposed by Convex.
 *
 * Setup:
 *   1. Get the URL: `npx convex env | grep CONVEX_SITE_URL`
 *      Public webhook URL is `<that URL>/clerk-webhook`.
 *   2. Clerk dashboard → Webhooks → add endpoint with the URL.
 *   3. `npx convex env set CLERK_WEBHOOK_SECRET whsec_xxx`
 */
import { httpRouter } from "convex/server"
import { clerkWebhook } from "./http/clerkWebhook"

const http = httpRouter()

http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: clerkWebhook,
})

export default http
