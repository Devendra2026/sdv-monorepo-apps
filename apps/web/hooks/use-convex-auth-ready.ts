"use client"

import { useConvexAuth } from "convex/react"

/** True once initial Convex auth has resolved and the user is authenticated. */
export function useConvexAuthReady(): boolean {
  const { isLoading, isAuthenticated } = useConvexAuth()
  return !isLoading && isAuthenticated
}

/** Granular Convex auth state for loading vs empty vs skip UX. */
export function useConvexAuthState(): {
  authLoading: boolean
  isAuthenticated: boolean
  authReady: boolean
} {
  const { isLoading, isAuthenticated } = useConvexAuth()
  return {
    authLoading: isLoading,
    isAuthenticated,
    authReady: !isLoading && isAuthenticated,
  }
}

/** True while Convex is refreshing the auth token in the background. */
export function useConvexAuthRefreshing(): boolean {
  const { isRefreshing } = useConvexAuth()
  return isRefreshing
}
