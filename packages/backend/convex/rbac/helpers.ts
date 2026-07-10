/**
 * Dynamic roles & permissions — admin-managed; reactive on web + mobile via Convex.
 */
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { PERMISSION_CATALOG, SYSTEM_ROLE_PERMISSIONS, SYSTEM_ROLES } from "../lib/permissionCatalog"
import { clientError } from "../shared/helpers"

export async function assertKnownPermissionKeys(ctx: MutationCtx, permissionKeys: string[]): Promise<void> {
  const known = await ctx.db.query("permissions").collect()
  const knownKeys = new Set(known.map((p) => p.key))
  for (const k of permissionKeys) {
    if (!knownKeys.has(k)) clientError("BAD_REQUEST", `Unknown permission: ${k}`)
  }
}

/** Seeds the RBAC catalog only when no permissions exist yet. */
export async function ensureRbacSeededIfEmpty(ctx: MutationCtx): Promise<boolean> {
  const existing = await ctx.db.query("permissions").first()
  if (existing) return false
  await seedSystemRbac(ctx)
  return true
}

/** Idempotent seed for permissions, system roles, and default grants. */
export async function seedSystemRbac(ctx: MutationCtx) {
  await Promise.all(
    PERMISSION_CATALOG.map(async (p) => {
      const existing = await ctx.db
        .query("permissions")
        .withIndex("by_key", (q) => q.eq("key", p.key))
        .unique()
      if (existing) {
        await ctx.db.patch(existing._id, { label: p.label, category: p.category, isActive: true })
      } else {
        await ctx.db.insert("permissions", {
          key: p.key,
          label: p.label,
          category: p.category,
          isActive: true,
        })
      }
    })
  )

  await Promise.all(
    SYSTEM_ROLES.map(async (r) => {
      let roleId = (
        await ctx.db
          .query("roles")
          .withIndex("by_key", (q) => q.eq("key", r.key))
          .unique()
      )?._id

      if (roleId) {
        await ctx.db.patch(roleId, { name: r.name, isSystem: r.isSystem, isActive: true })
      } else {
        roleId = await ctx.db.insert("roles", {
          key: r.key,
          name: r.name,
          isSystem: r.isSystem,
          isActive: true,
        })
      }

      const desired = new Set<string>(SYSTEM_ROLE_PERMISSIONS[r.key] ?? [])
      const existingPerms = await ctx.db
        .query("rolePermissions")
        .withIndex("by_role", (q) => q.eq("roleId", roleId))
        .collect()

      const deleteOps = []
      for (const row of existingPerms) {
        if (!desired.has(row.permissionKey)) deleteOps.push(ctx.db.delete(row._id))
      }
      await Promise.all(deleteOps)

      const existingKeys = new Set(existingPerms.map((row) => row.permissionKey))
      const insertOps = []
      for (const key of desired) {
        if (!existingKeys.has(key)) insertOps.push(ctx.db.insert("rolePermissions", { roleId, permissionKey: key }))
      }
      await Promise.all(insertOps)
    })
  )
}

export async function listRolesWithPermissions(ctx: QueryCtx, includeInactive: boolean | undefined) {
  const roles = includeInactive
    ? await ctx.db.query("roles").collect()
    : await ctx.db
        .query("roles")
        .withIndex("by_active", (q) => q.eq("isActive", true))
        .collect()

  const permRows = await ctx.db.query("rolePermissions").collect()
  const permsByRole = new Map<string, string[]>()
  for (const row of permRows) {
    const existing = permsByRole.get(row.roleId) ?? []
    existing.push(row.permissionKey)
    permsByRole.set(row.roleId, existing)
  }

  return roles
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((role) => ({
      ...role,
      permissionKeys: (permsByRole.get(role._id) ?? []).sort(),
    }))
}
