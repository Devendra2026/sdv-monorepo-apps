import { SYSTEM_ROLE_PERMISSIONS, type PermissionKey } from "@/convex/permissionCatalog";

const TENANCY_PERMISSIONS: PermissionKey[] = ["surveys.viewAssigned", "surveys.viewOwn", "qc.review"];

const SYSTEM_ROLE_KEYS = new Set(["pending", "surveyor", "supervisor", "qc_supervisor", "admin"]);

export function roleRequiresTenancy(roleKey: string, permissionKeys?: readonly string[]): boolean {
  if (roleKey === "admin" || roleKey === "pending") return false;
  const keys = permissionKeys ?? SYSTEM_ROLE_PERMISSIONS[roleKey] ?? [];
  return TENANCY_PERMISSIONS.some((p) => keys.includes(p));
}

export function isSystemRoleKey(roleKey: string): boolean {
  return SYSTEM_ROLE_KEYS.has(roleKey);
}

/** Field supervisor and QC supervisor default to district-level tenant scope. */
export function isDistrictScopedRole(roleKey: string): boolean {
  return roleKey === "supervisor" || roleKey === "qc_supervisor";
}

export function partitionRoles<T extends { key: string; name: string; isSystem?: boolean }>(roles: T[]) {
  const system = roles.filter((r) => r.isSystem ?? isSystemRoleKey(r.key));
  const custom = roles.filter((r) => !(r.isSystem ?? isSystemRoleKey(r.key)));
  return { system, custom };
}
