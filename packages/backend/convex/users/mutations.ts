import { v } from "convex/values"
import { internal } from "../_generated/api"
import { mutation } from "../_generated/server"
import { clientError, requireIdentity } from "../shared/helpers"
import { upsertUserRecord } from "./helpers"

/**
 * Idempotent provisioning for the signed-in Clerk user. Called from the
 * setup screen so Convex has a `users` row even when the webhook has not
 * fired yet.
 */
export const provisionCurrentUser = mutation({
  args: {
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    requestedRole: v.optional(v.string()),
    requestedReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ident = await requireIdentity(ctx)

    await ctx.runMutation(internal.rbac.internal.ensureSeeded, {})

    const email = (ident.email ?? "").trim()
    if (!email) {
      clientError("PROFILE_INCOMPLETE", "An email address is required. Finish sign-up in Clerk or add a primary email.")
    }
    const name = (ident.name ?? args.name ?? email).trim() || email

    return await upsertUserRecord(
      ctx,
      {
        clerkId: ident.subject,
        email,
        name,
        avatarUrl: ident.pictureUrl ?? args.avatarUrl,
        requestedRole: args.requestedRole,
        requestedReason: args.requestedReason,
      },
      { fillSignupMetadataOnlyIfEmpty: true }
    )
  },
})
