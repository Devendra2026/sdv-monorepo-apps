import { v } from "convex/values"
import { capabilityMutation } from "../lib/customFunctions"
import { SYSTEM_ROLES } from "../lib/permissionCatalog"
import { clientError, writeAudit } from "../shared/helpers"
import { assertKnownPermissionKeys, seedSystemRbac } from "./helpers"

const rolesManageMutation = capabilityMutation("roles.manage")

export const seedSystem = rolesManageMutation({
  args: {},
  handler: async (ctx) => {
    await seedSystemRbac(ctx)
    await writeAudit(ctx, { actorId: ctx.user._id, action: "rbac.seeded", entity: "rbac" })
    return { ok: true as const }
  },
})

export const createRole = rolesManageMutation({
  args: {
    key: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    permissionKeys: v.array(v.string()),
  },
  handler: async (ctx, args) => {
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
        actorId: ctx.user._id,
        action: "role.created",
        entity: "role",
        entityId: roleId,
        metadata: { key, permissionKeys: args.permissionKeys },
      }),
    ])
    return roleId
  },
})

export const updateRole = rolesManageMutation({
  args: {
    roleId: v.id("roles"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    permissionKeys: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const role = await ctx.db.get(args.roleId)
    if (!role) clientError("NOT_FOUND", "Role not found")

    // System roles (admin, pending, …) must not have permissionKeys / deactivation mutated.
    if (role.isSystem) {
      if (args.permissionKeys !== undefined) {
        clientError("FORBIDDEN", "Cannot change permissions on a system role")
      }
      if (args.isActive !== undefined && args.isActive === false) {
        clientError("FORBIDDEN", "Cannot deactivate a system role")
      }
    }

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
      actorId: ctx.user._id,
      action: "role.updated",
      entity: "role",
      entityId: args.roleId,
      metadata: { ...patch, permissionKeys: args.permissionKeys },
    })
  },
})

export const createPermission = rolesManageMutation({
  args: {
    key: v.string(),
    label: v.string(),
    category: v.string(),
  },
  handler: async (ctx, args) => {
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
      actorId: ctx.user._id,
      action: "permission.created",
      entity: "permission",
      entityId: id,
      metadata: { key },
    })
    return id
  },
})
