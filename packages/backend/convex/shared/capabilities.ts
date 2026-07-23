/**
 * Server-side capability resolution from dynamic roles + permissions tables.
 */
import { ConvexError } from "convex/values"
import type { Doc } from "../_generated/dataModel"
import type { MutationCtx, QueryCtx } from "../_generated/server"
import { SYSTEM_ROLE_PERMISSIONS } from "../lib/permissionCatalog"

type Ctx = QueryCtx | MutationCtx

/** Per-request cache — same ctx object is reused for the whole mutation/query. */
const rolePermCacheByCtx = new WeakMap<object, Map<string, Set<string>>>()

export async function permissionsForRole(ctx: Ctx, roleKey: string): Promise<Set<string>> {
  let byRole = rolePermCacheByCtx.get(ctx as object)
  if (!byRole) {
    byRole = new Map()
    rolePermCacheByCtx.set(ctx as object, byRole)
  }
  const cached = byRole.get(roleKey)
  if (cached) return cached

  const roles = await ctx.db
    .query("roles")
    .withIndex("by_key", (q) => q.eq("key", roleKey))
    .take(2)
  const role = roles[0]

  let result: Set<string>
  if (!role || role.isActive === false) {
    const fallback = SYSTEM_ROLE_PERMISSIONS[roleKey]
    result = fallback ? new Set(fallback) : new Set()
  } else {
    const rows = await ctx.db
      .query("rolePermissions")
      .withIndex("by_role", (q) => q.eq("roleId", role._id))
      .collect()
    result = new Set(rows.map((r) => r.permissionKey))
  }

  byRole.set(roleKey, result)
  return result
}

export async function userCapabilities(ctx: Ctx, user: Doc<"users">): Promise<string[]> {
  const perms = await permissionsForRole(ctx, user.role)
  return Array.from(perms).sort()
}

export async function hasCapability(ctx: Ctx, user: Doc<"users">, capability: string): Promise<boolean> {
  const perms = await permissionsForRole(ctx, user.role)
  return perms.has(capability)
}

export async function requireCapability(ctx: Ctx, user: Doc<"users">, capability: string): Promise<void> {
  const ok = await hasCapability(ctx, user, capability)
  if (!ok) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "You don't have permission for this action.",
    })
  }
}

const TENANCY_CAPABILITIES = ["surveys.viewAssigned", "surveys.viewOwn", "qc.review"] as const

/** Field roles (system or custom) that need district / ULB / ward scope. */
export async function roleRequiresTenancy(ctx: Ctx, roleKey: string): Promise<boolean> {
  if (roleKey === "admin" || roleKey === "pending") return false
  const perms = await permissionsForRole(ctx, roleKey)
  return TENANCY_CAPABILITIES.some((key) => perms.has(key))
}
