import { v } from "convex/values"
import { mutation } from "../_generated/server"
import { clientError, requireRole, requireUser, writeAudit } from "../shared/helpers"
import { SYSTEM_ROLES } from "../lib/permissionCatalog"
import { assertKnownPermissionKeys, seedSystemRbac } from "./helpers"

export const seedSystem = mutation({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx)
    requireRole(me, "admin")
    await seedSystemRbac(ctx)
    await writeAudit(ctx, { actorId: me._id, action: "rbac.seeded", entity: "rbac" })
    return { ok: true as const }
  },
})

export const createRole = mutation({
  args: {
    key: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    permissionKeys: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    requireRole(me, "admin")

    const key = args.key.trim().toLowerCase().replace(/\s+/g, "_")
    if (!/^[a-z][a-z0-9_]{1,48}$/.test(key)) {
      clientError("BAD_REQUEST", "Role key must be 2–49 lowercase letters, numbers, or underscores")
    }
    if (SYSTEM_ROLES.some((r) => r.key === key)) {
      clientError("BAD_REQUEST", "This role key is reserved for a system role")
    }

    const dup = await ctx.db
      .query("roles")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique()
    if (dup) clientError("BAD_REQUEST", "Role key already exists")

    await assertKnownPermissionKeys(ctx, args.permissionKeys)

    const roleId = await ctx.db.insert("roles", {
      key,
      name: args.name.trim(),
      description: args.description?.trim(),
      isSystem: false,
      isActive: true,
    })

    await Promise.all([
      ...args.permissionKeys.map((permissionKey) => ctx.db.insert("rolePermissions", { roleId, permissionKey })),
      writeAudit(ctx, {
        actorId: me._id,
        action: "role.created",
        entity: "role",
        entityId: roleId,
        metadata: { key, permissionKeys: args.permissionKeys },
      }),
    ])
    return roleId
  },
})

export const updateRole = mutation({
  args: {
    roleId: v.id("roles"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    permissionKeys: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    requireRole(me, "admin")

    const role = await ctx.db.get(args.roleId)
    if (!role) clientError("NOT_FOUND", "Role not found")

    const patch: { name?: string; description?: string; isActive?: boolean } = {}
    if (args.name !== undefined) patch.name = args.name.trim()
    if (args.description !== undefined) patch.description = args.description.trim()
    if (args.isActive !== undefined) patch.isActive = args.isActive
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.roleId, patch)
    }

    if (args.permissionKeys !== undefined) {
      await assertKnownPermissionKeys(ctx, args.permissionKeys)
      const existing = await ctx.db
        .query("rolePermissions")
        .withIndex("by_role", (q) => q.eq("roleId", args.roleId))
        .collect()
      await Promise.all(existing.map((row) => ctx.db.delete(row._id)))
      await Promise.all(
        args.permissionKeys.map((permissionKey) =>
          ctx.db.insert("rolePermissions", { roleId: args.roleId, permissionKey })
        )
      )
    }

    await writeAudit(ctx, {
      actorId: me._id,
      action: "role.updated",
      entity: "role",
      entityId: args.roleId,
      metadata: { ...patch, permissionKeys: args.permissionKeys },
    })
  },
})

export const createPermission = mutation({
  args: {
    key: v.string(),
    label: v.string(),
    category: v.string(),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx)
    requireRole(me, "admin")

    const key = args.key.trim()
    const existing = await ctx.db
      .query("permissions")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique()
    if (existing) clientError("BAD_REQUEST", "Permission key already exists")

    const id = await ctx.db.insert("permissions", {
      key,
      label: args.label.trim(),
      category: args.category.trim(),
      isActive: true,
    })
    await writeAudit(ctx, {
      actorId: me._id,
      action: "permission.created",
      entity: "permission",
      entityId: id,
      metadata: { key },
    })
    return id
  },
})
