/**
 * Admin-only operations — mutations.
 *
 * Every function in this module calls `requireRole(me, "admin")` or capability checks
 * so the mobile app can call these directly without an additional auth check.
 */
import { ConvexError, v } from "convex/values"
import { mutation } from "../_generated/server"
import { replaceUserAllotments, upsertAllotmentForUser } from "../allotments/helpers"
import { roleRequiresTenancy } from "../shared/capabilities"
import {
  assertUserVisibleToCaller,
  clientError,
  requireRole,
  requireUser,
  writeAudit,
} from "../shared/helpers"
import { resolveMasterCategory } from "../lib/masters/taxationMasters"
import { userRole } from "../schema"
import { allotmentInput, assertCanPatchUser } from "./helpers"

/**
 * Approve a pending user, granting role + tenant scope in one atomic step.
 *
 * - role must be surveyor | supervisor | admin (not "pending")
 * - surveyor & supervisor require municipalityId (district is denormalized from ULB)
 * - ward is chosen on each survey at start (not required at approval)
 */
export const approveUser = mutation({
  args: {
    userId: v.id("users"),
    role: v.string(),
    municipalityId: v.optional(v.id("municipalities")),
    districtId: v.optional(v.id("districts")),
    wardAssignments: v.optional(v.array(v.string())),
    allotments: v.optional(v.array(allotmentInput)),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    requireRole(me, "admin")

    const target = await ctx.db.get(args.userId)
    if (!target) clientError("NOT_FOUND", "User not found")
    if (target.status === "active" && target.role !== "pending") {
      clientError("ALREADY_APPROVED", "This user is already active")
    }

    // Validate role-specific requirements
    const wards = args.wardAssignments ?? []
    let districtId = args.districtId
    const hasAllotments = (args.allotments?.length ?? 0) > 0
    const roleRow = await ctx.db
      .query("roles")
      .withIndex("by_key", (q) => q.eq("key", args.role))
      .unique()
    if (!roleRow || roleRow.isActive === false) {
      clientError("BAD_REQUEST", "Unknown or inactive role")
    }
    if (args.role === "pending") {
      clientError("BAD_REQUEST", "Cannot approve with pending role")
    }

    if (args.role !== "admin") {
      if (!args.municipalityId && !args.districtId && !hasAllotments) {
        clientError("BAD_REQUEST", "Assign a district, ULB, or allotment list for surveyor/supervisor", {
          municipalityId: ["select a ULB, district, or allotments"],
        })
      }
      if (args.municipalityId) {
        const muni = await ctx.db.get(args.municipalityId)
        if (!muni) clientError("BAD_REQUEST", "Unknown municipality")
        districtId = muni.districtId
      } else if (args.districtId) {
        const dist = await ctx.db.get(args.districtId)
        if (!dist) clientError("BAD_REQUEST", "Unknown district")
      }
    }
    await ctx.db.patch(args.userId, {
      role: args.role,
      status: "active",
      districtId: args.role === "admin" ? undefined : districtId,
      municipalityId: args.municipalityId,
      wardAssignments: wards,
      approvedBy: me._id,
      approvedAt: Date.now(),
    })

    if (args.role !== "admin" && hasAllotments) {
      await replaceUserAllotments(ctx, {
        userId: args.userId,
        allotments: args.allotments!,
        assignedBy: me._id,
      })
    } else if (args.role !== "admin" && (args.municipalityId || args.districtId)) {
      await upsertAllotmentForUser(ctx, {
        userId: args.userId,
        municipalityId: args.municipalityId,
        districtId: args.districtId,
        assignedBy: me._id,
      })
    }

    await writeAudit(ctx, {
      actorId: me._id,
      action: "user.approved",
      entity: "user",
      entityId: args.userId,
      metadata: {
        role: args.role,
        municipalityId: args.municipalityId,
        wardAssignments: wards,
      },
    })

    // Drop a notification so the user sees "approved!" next time they open the app.
    await ctx.db.insert("notifications", {
      userId: args.userId,
      type: "account_approved",
      title: "Account approved",
      body: `You've been granted ${args.role} access. Pull-to-refresh to start.`,
    })
  },
})

/** Reject a pending user — keeps the row (audit trail) but disables it. */
export const rejectUser = mutation({
  args: {
    userId: v.id("users"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const [me, target] = await Promise.all([requireUser(ctx), ctx.db.get(args.userId)])
    requireRole(me, "admin")
    if (!target) clientError("NOT_FOUND", "User not found")

    await Promise.all([
      ctx.db.patch(args.userId, {
        status: "disabled",
        disabledBy: me._id,
        disabledAt: Date.now(),
      }),
      writeAudit(ctx, {
        actorId: me._id,
        action: "user.rejected",
        entity: "user",
        entityId: args.userId,
        metadata: { reason: args.reason },
      }),
      ctx.db.insert("notifications", {
        userId: args.userId,
        type: "account_rejected",
        title: "Account request denied",
        body: args.reason ?? "Contact your administrator for more information.",
      }),
    ])
  },
})

/** Assign district + ULB for an active surveyor or supervisor. */
export const assignTenant = mutation({
  args: {
    userId: v.id("users"),
    municipalityId: v.id("municipalities"),
    wardAssignments: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    requireRole(me, "admin")

    const [target, muni] = await Promise.all([ctx.db.get(args.userId), ctx.db.get(args.municipalityId)])
    if (!target) clientError("NOT_FOUND", "User not found")
    if (!(await roleRequiresTenancy(ctx, target.role))) {
      clientError("BAD_REQUEST", "Tenant assignment applies to field roles with tenant scope only")
    }
    if (!muni || muni.isActive === false) {
      clientError("BAD_REQUEST", "Unknown municipality")
    }

    await Promise.all([
      ctx.db.patch(args.userId, {
        municipalityId: args.municipalityId,
        districtId: muni.districtId,
        wardAssignments: args.wardAssignments ?? [],
      }),
      upsertAllotmentForUser(ctx, {
        userId: args.userId,
        municipalityId: args.municipalityId,
        assignedBy: me._id,
      }),
      writeAudit(ctx, {
        actorId: me._id,
        action: "user.tenant_assigned",
        entity: "user",
        entityId: args.userId,
        metadata: { municipalityId: args.municipalityId, districtId: muni.districtId },
      }),
    ])
  },
})

export const updateUser = mutation({
  args: {
    userId: v.id("users"),
    role: v.optional(userRole),
    municipalityId: v.optional(v.id("municipalities")),
    districtId: v.optional(v.id("districts")),
    wardAssignments: v.optional(v.array(v.string())),
    status: v.optional(v.union(v.literal("active"), v.literal("disabled"))),
  },
  handler: async (ctx, args) => {
    const [me, target] = await Promise.all([requireUser(ctx), ctx.db.get(args.userId)])
    await assertCanPatchUser(ctx, me, args)
    if (!target) clientError("NOT_FOUND", "User not found")
    await assertUserVisibleToCaller(ctx, me, target)

    const patch: Record<string, unknown> = {}
    if (args.role !== undefined) patch.role = args.role
    if (args.municipalityId !== undefined) {
      patch.municipalityId = args.municipalityId
      const muni = await ctx.db.get(args.municipalityId)
      if (muni) patch.districtId = muni.districtId
    }
    if (args.districtId !== undefined) patch.districtId = args.districtId
    if (args.wardAssignments !== undefined) patch.wardAssignments = args.wardAssignments
    if (args.status !== undefined) {
      patch.status = args.status
      if (args.status === "disabled") {
        patch.disabledBy = me._id
        patch.disabledAt = Date.now()
      }
    }
    if (Object.keys(patch).length === 0) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Nothing to update" })
    }
    await Promise.all([
      ctx.db.patch(args.userId, patch),
      writeAudit(ctx, {
        actorId: me._id,
        action: "user.updated",
        entity: "user",
        entityId: args.userId,
        metadata: patch,
      }),
    ])
  },
})

export const upsertMaster = mutation({
  args: {
    category: v.string(),
    value: v.string(),
    label: v.string(),
    position: v.number(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    requireRole(me, "admin")
    const category = resolveMasterCategory(args.category)

    const existing = await ctx.db
      .query("masters")
      .withIndex("by_category_value", (q) => q.eq("category", category).eq("value", args.value))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, {
        label: args.label,
        position: args.position,
        isActive: args.isActive,
      })
      return existing._id
    }
    return await ctx.db.insert("masters", { ...args, category })
  },
})

export const deleteMaster = mutation({
  args: { id: v.id("masters") },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    requireRole(me, "admin")
    await ctx.db.delete(args.id)
  },
})
