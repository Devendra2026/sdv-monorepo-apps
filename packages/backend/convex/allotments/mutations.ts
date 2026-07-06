import { v } from "convex/values"
import { mutation } from "../_generated/server"
import { roleRequiresTenancy } from "../shared/capabilities"
import { clientError, requireRole, requireUser, writeAudit } from "../shared/helpers"
import { replaceUserAllotments } from "./helpers"

const allotmentInput = v.object({
  districtId: v.optional(v.id("districts")),
  municipalityId: v.optional(v.id("municipalities")),
  isActive: v.boolean(),
})

/** Replace all allotments for a field user (admin). */
export const setForUser = mutation({
  args: {
    userId: v.id("users"),
    allotments: v.array(allotmentInput),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    requireRole(me, "admin")

    const target = await ctx.db.get(args.userId)
    if (!target) clientError("NOT_FOUND", "User not found")
    if (!(await roleRequiresTenancy(ctx, target.role))) {
      clientError("BAD_REQUEST", "Allotments apply to field roles with tenant scope only")
    }

    await replaceUserAllotments(ctx, {
      userId: args.userId,
      allotments: args.allotments,
      assignedBy: me._id,
    })

    await writeAudit(ctx, {
      actorId: me._id,
      action: "user.allotments_set",
      entity: "user",
      entityId: args.userId,
      metadata: { count: args.allotments.length },
    })
  },
})

export const setActive = mutation({
  args: {
    allotmentId: v.id("userAllotments"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    requireRole(me, "admin")

    const row = await ctx.db.get(args.allotmentId)
    if (!row) clientError("NOT_FOUND", "Allotment not found")

    await ctx.db.patch(args.allotmentId, { isActive: args.isActive })
    await writeAudit(ctx, {
      actorId: me._id,
      action: "user.allotment_toggled",
      entity: "userAllotments",
      entityId: args.allotmentId,
      metadata: { isActive: args.isActive },
    })
  },
})
