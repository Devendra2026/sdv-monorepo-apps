"use client";

import { PermissionDeniedDialog, PermissionDeniedInline } from "@/components/shared/permission-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { canAnyWithCapabilities, canWithCapabilities, type Capability } from "@/lib/permissions";
import { useCurrentUser } from "@/lib/session";

/**
 * Hides children unless the current user's role has the capability. This is a
 * UI affordance only — the server still enforces every action (see
 * permissions.ts header). Pair with hook-level `"skip"` so Convex queries
 * never throw FORBIDDEN for unauthorized users.
 *
 * - `mode="page"` — shows an access-denied modal and redirects to the dashboard.
 * - `mode="inline"` — hides the section silently, or shows a compact inline note.
 */
export function RoleGate({
  capability,
  anyOf,
  children,
  fallback,
  mode = "inline",
  deniedTitle = "Access Denied",
  deniedDescription = "You don't have permission to view this section.",
  redirectTo = "/dashboard",
}: {
  capability?: Capability;
  anyOf?: Capability[];
  children: React.ReactNode;
  /** Override default denied UI. Pass `null` to render nothing. */
  fallback?: React.ReactNode | null;
  mode?: "page" | "inline";
  deniedTitle?: string;
  deniedDescription?: string;
  redirectTo?: string;
}) {
  const { role, capabilities, isLoading } = useCurrentUser();
  const allowed = capability
    ? canWithCapabilities(capabilities, role, capability)
    : anyOf
      ? canAnyWithCapabilities(capabilities, role, anyOf)
      : false;

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading permissions">
        <Skeleton className="h-9 w-48 rounded-xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }
  if (allowed) return <>{children}</>;

  if (fallback !== undefined) return <>{fallback}</>;

  if (mode === "page") {
    return <PermissionDeniedDialog title={deniedTitle} description={deniedDescription} redirectTo={redirectTo} />;
  }

  return <PermissionDeniedInline description={deniedDescription} />;
}
