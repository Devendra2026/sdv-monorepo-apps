"use client";

import { useConvexAuth } from "convex/react";

export function useConvexAuthReady(): boolean {
  const { isLoading, isAuthenticated, isRefreshing } = useConvexAuth();
  return !isLoading && isAuthenticated && !isRefreshing;
}
