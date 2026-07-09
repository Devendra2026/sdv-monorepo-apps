import { v } from "convex/values"
import { internalMutation } from "../_generated/server"
import { ensureRbacSeededIfEmpty } from "../rbac/helpers"
import { writeAudit } from "../shared/helpers"
import { upsertUserRecord } from "./helpers"

export const upsertFromClerk = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
    requestedRole: v.optional(v.string()),
    requestedReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ensureRbacSeededIfEmpty(ctx)
    return await upsertUserRecord(ctx, args, {
      fillSignupMetadataOnlyIfEmpty: false,
    })
  },
})

export const softDeleteFromClerk = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique()

    if (!user) return

    await ctx.db.patch(user._id, {
      status: "disabled",
      disabledAt: Date.now(),
    })

    await writeAudit(ctx, {
      action: "user.deleted",
      entity: "user",
      entityId: user._id,
      metadata: { clerkId: args.clerkId },
    })
  },
})
