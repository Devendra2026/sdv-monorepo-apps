/**
 * permissions.ts — Role → capability matrix for the WEB UI.
 *
 * ⚠️  This is a UI-gating convenience ONLY. The authoritative enforcement is
 *     server-side in Convex (`requireRole`, `assertMunicipalityInScope`,
 *     `assertCanReadWard`, and the per-mutation checks in surveys.ts / qc.ts /
 *     admin.ts). Never treat a `can()` result as a security boundary — if the
 *     UI lets a call through, the server still rejects it. This file exists so
 *     we hide actions a user definitely cannot perform, not to *grant* them.
 *
 * The capability names below are derived directly from the brief's role matrix
 * and cross-checked against the actual Convex function guards:
 *   - admin functions: admin.ts (`requireRole(me, 'admin')`)
 *   - qc.decide / qc.reopen: `requireRole(me, 'supervisor', 'admin')`
 *   - survey edit/submit: surveyor (own) + supervisor/admin (scope)
 */

/** Built-in roles; admin may add custom role keys via Convex `roles` table. */
export type Role = "pending" | "surveyor" | "supervisor" | "admin" | (string & {});

export type Capability =
  // user management (admin only)
  | "users.approve"
  | "users.disable"
  | "users.assignTenant"
  | "users.view"
  | "roles.manage"
  // tenants / masters (admin only)
  | "tenants.manage"
  | "masters.manage"
  // surveys
  | "surveys.viewAll"
  | "surveys.viewAssigned"
  | "surveys.viewOwn"
  | "surveys.editDraft"
  | "surveys.submit"
  | "surveys.uploadPhotos"
  | "surveys.delete"
  | "surveys.reassign"
  // qc
  | "qc.review"
  | "qc.decide" // approve / reject
  | "qc.requestCorrection" // add remark
  | "qc.reopen" // override an approved decision
  // analytics / audit / reports
  | "analytics.view"
  | "audit.view"
  | "reports.export";

const MATRIX: Record<Role, Capability[]> = {
  pending: [],

  surveyor: ["surveys.viewOwn", "surveys.editDraft", "surveys.submit", "surveys.uploadPhotos"],

  supervisor: [
    "surveys.viewAssigned",
    "surveys.editDraft",
    "surveys.submit",
    "surveys.uploadPhotos",
    "analytics.view",
    "users.view",
    "reports.export",
  ],

  qc_supervisor: [
    "qc.review",
    "qc.decide",
    "qc.requestCorrection",
    "qc.reopen",
    "surveys.uploadPhotos",
    "analytics.view",
    "reports.export",
  ],

  admin: [
    "users.approve",
    "users.disable",
    "users.assignTenant",
    "users.view",
    "roles.manage",
    "tenants.manage",
    "masters.manage",
    "surveys.viewAll",
    "surveys.editDraft",
    "surveys.submit",
    "surveys.uploadPhotos",
    "surveys.delete",
    "surveys.reassign",
    "qc.review",
    "qc.decide",
    "qc.requestCorrection",
    "qc.reopen",
    "analytics.view",
    "audit.view",
    "reports.export",
  ],
};

export function can(role: Role | undefined, capability: Capability): boolean {
  if (!role) return false;
  return MATRIX[role as keyof typeof MATRIX]?.includes(capability) ?? false;
}

function canAny(role: Role | undefined, capabilities: Capability[]): boolean {
  return capabilities.some((c) => can(role, c));
}

/** Prefer server capabilities from `users.currentUser` when available (dynamic RBAC). */
export function canWithCapabilities(
  serverCapabilities: string[] | undefined,
  role: Role | undefined,
  capability: Capability,
): boolean {
  if (serverCapabilities && serverCapabilities.length > 0) {
    return serverCapabilities.includes(capability);
  }
  return can(role, capability);
}

export function canAnyWithCapabilities(
  serverCapabilities: string[] | undefined,
  role: Role | undefined,
  capabilities: Capability[],
): boolean {
  return capabilities.some((c) => canWithCapabilities(serverCapabilities, role, c));
}

/** True when the user may only access the QC portal (no survey module). */
export function isQcOnlyUser(serverCapabilities: string[] | undefined, role: Role | undefined): boolean {
  if (serverCapabilities && serverCapabilities.length > 0) {
    const hasQc = serverCapabilities.some((c) => c.startsWith("qc."));
    const hasSurveys = serverCapabilities.some((c) => c.startsWith("surveys.") && c !== "surveys.uploadPhotos");
    return hasQc && !hasSurveys;
  }
  return role === "qc_supervisor";
}

/** Nav keys from server capabilities (falls back to static NAV_VISIBILITY). */
export function navKeysForUser(serverCapabilities: string[] | undefined, role: Role | undefined): string[] {
  if (serverCapabilities && serverCapabilities.length > 0) {
    const keys = new Set<string>();
    const hasSurveysNav = serverCapabilities.some((c) => c.startsWith("surveys.") && c !== "surveys.uploadPhotos");
    const hasQc = serverCapabilities.some((c) => c.startsWith("qc."));
    if (serverCapabilities.some((c) => c.startsWith("analytics.")) || hasSurveysNav || hasQc) {
      keys.add("dashboard");
    }
    if (hasSurveysNav) {
      keys.add("surveys");
      keys.add("surveys_registry");
    }
    if (hasQc) {
      keys.add("qc");
      keys.add("qc_registry");
    }
    if (serverCapabilities.some((c) => c.startsWith("users."))) keys.add("users");
    if (serverCapabilities.includes("roles.manage")) keys.add("roles");
    if (serverCapabilities.some((c) => c.startsWith("masters."))) keys.add("masters");
    if (serverCapabilities.some((c) => c.startsWith("reports."))) keys.add("reports");
    if (serverCapabilities.includes("audit.view")) keys.add("audit");
    keys.add("settings");
    return [...keys];
  }
  return NAV_VISIBILITY[role as keyof typeof NAV_VISIBILITY] ?? [];
}

/** Which nav sections a role may see. Keep in sync with components/layout/sidebar. */
const NAV_VISIBILITY: Record<Role, string[]> = {
  pending: [],
  surveyor: ["dashboard", "surveys_registry", "settings"],
  supervisor: ["dashboard", "surveys", "surveys_registry", "users", "reports", "settings"],
  qc_supervisor: ["dashboard", "qc", "qc_registry", "reports", "settings"],
  admin: [
    "dashboard",
    "surveys",
    "surveys_registry",
    "qc",
    "qc_registry",
    "users",
    "roles",
    "masters",
    "reports",
    "audit",
    "settings",
  ],
};
