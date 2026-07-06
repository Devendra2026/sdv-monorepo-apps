import { v } from "convex/values"
import { mutation } from "../_generated/server"
import { requireUser } from "../shared/helpers"

export const markRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    const [me, n] = await Promise.all([requireUser(ctx), ctx.db.get(args.id)])
    if (!n || n.userId !== me._id) return
    if (n.readAt) return
    await ctx.db.patch(args.id, { readAt: Date.now() })
  },
})

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx)
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", me._id).eq("readAt", undefined))
      .collect()
    const now = Date.now()
    await Promise.all(unread.map((n) => ctx.db.patch(n._id, { readAt: now })))
  },
})
