"use client"

import { useAuth } from "@clerk/nextjs"
import { useConvexAuth } from "convex/react"

/** Why Convex auth is still loading after the hang timeout. */
export type AuthHangReason = "clerk" | "convex_ws"

/** True once initial Convex auth has resolved and the user is authenticated. */
export function useConvexAuthReady(): boolean {
  const { isLoading, isAuthenticated } = useConvexAuth()
  return !isLoading && isAuthenticated
}

/** Granular Convex + Clerk auth state for loading vs empty vs skip UX. */
export function useConvexAuthState(): {
  authLoading: boolean
  isAuthenticated: boolean
  authReady: boolean
  /** False while Clerk JS / session has not finished loading. */
  clerkLoaded: boolean
} {
  const { isLoaded: clerkLoaded } = useAuth()
  const { isLoading, isAuthenticated } = useConvexAuth()
  return {
    authLoading: isLoading,
    isAuthenticated,
    authReady: !isLoading && isAuthenticated,
    clerkLoaded,
  }
}

/**
 * Classify a Convex auth hang: Clerk never finished loading vs Clerk OK but
 * Convex WebSocket auth confirmation never arrived.
 */
export function classifyAuthHang(clerkLoaded: boolean): AuthHangReason {
  return clerkLoaded ? "convex_ws" : "clerk"
}

/** True while Convex is refreshing the auth token in the background. */
export function useConvexAuthRefreshing(): boolean {
  const { isRefreshing } = useConvexAuth()
  return isRefreshing
}
