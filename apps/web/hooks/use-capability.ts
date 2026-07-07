"use client";

import { useConvexAuthReady } from "@/hooks/use-convex-auth-ready";
import { canWithCapabilities, type Capability } from "@/lib/permissions";
import { useCurrentUser } from "@/lib/sessions";

/**
 * True when the signed-in user has the capability. Returns false while the
 * session is loading so callers can pass `"skip"` to useQuery and avoid
 * server-side FORBIDDEN errors for unauthorized roles.
 */
export function useHasCapability(capability: Capability): boolean {
  const ready = useConvexAuthReady();
  const { role, capabilities, isLoading } = useCurrentUser();
  if (!ready || isLoading || !role) return false;
  return canWithCapabilities(capabilities, role, capability);
}
