"use client";

import { useSyncExternalStore } from "react";

/** Client-only gate for Radix UI — avoids SSR/client ID mismatches without a mount effect flash. */
export function useClientMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
