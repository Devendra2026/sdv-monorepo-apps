"use client"

import { useConvexAuth } from "convex/react"

/** True once initial Convex auth has resolved and the user is authenticated. */
export function useConvexAuthReady(): boolean {
  const { isLoading, isAuthenticated } = useConvexAuth()
  return !isLoading && isAuthenticated
}

/** True while Convex is refreshing the auth token in the background. */
export function useConvexAuthRefreshing(): boolean {
  const { isRefreshing } = useConvexAuth()
  return isRefreshing
}
