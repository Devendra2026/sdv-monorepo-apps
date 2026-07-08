"use client"

import { useConvexAuthReady } from "@/hooks/use-convex-auth-ready"
import type { Role } from "@/lib/permissions"
import { api } from "@workspace/backend/convex/_generated/api.js"
import { useMutation, usePreloadedQuery, useQuery, type Preloaded } from "convex/react"
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"

export type CurrentUser = {
  _id: string
  email: string
  name: string
  role: Role
  roleName?: string
  status: "pending_approval" | "active" | "disabled"
  districtId?: string
  municipalityId?: string
  wardAssignments: string[]
  municipality: { code: string; name: string } | null
  district: { code: string; name: string } | null
  capabilities?: string[]
}

type CurrentUserContextValue = {
  user: CurrentUser | null
  role: Role | undefined
  capabilities: string[] | undefined
  roleName: string | undefined
  isLoading: boolean
  isProvisioning: boolean
  provisionFailed: boolean
  retryProvision: () => void
  isActive: boolean
  isPending: boolean
  isDisabled: boolean
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null)

function useProvisionFlow(user: CurrentUser | null | undefined) {
  const provision = useMutation(api.users.mutations.provisionCurrentUser)
  const provisioned = useRef(false)
  const [provisionFailed, setProvisionFailed] = useState(false)
  const [isProvisioning, setIsProvisioning] = useState(false)

  const runProvision = useCallback(async () => {
    setIsProvisioning(true)
    setProvisionFailed(false)
    try {
      await provision({})
    } catch {
      setProvisionFailed(true)
      provisioned.current = false
    } finally {
      setIsProvisioning(false)
    }
  }, [provision])

  useEffect(() => {
    if (user === null && !provisioned.current && !isProvisioning) {
      provisioned.current = true
      void runProvision()
    }
  }, [user, isProvisioning, runProvision])

  const retryProvision = useCallback(() => {
    provisioned.current = true
    void runProvision()
  }, [runProvision])

  return {
    isProvisioning: user === null && (isProvisioning || !provisionFailed),
    provisionFailed: user === null && provisionFailed,
    retryProvision,
  }
}

function buildContextValue(
  user: CurrentUser | null | undefined,
  provision: ReturnType<typeof useProvisionFlow>
): CurrentUserContextValue {
  return {
    user: user ?? null,
    role: (user?.role ?? undefined) as Role | undefined,
    capabilities: user?.capabilities,
    roleName: user?.roleName,
    isLoading: user === undefined,
    isProvisioning: provision.isProvisioning,
    provisionFailed: provision.provisionFailed,
    retryProvision: provision.retryProvision,
    isActive: user?.status === "active",
    isPending: user?.status === "pending_approval",
    isDisabled: user?.status === "disabled",
  }
}

function CurrentUserProviderPreloaded({
  children,
  preloadedUser,
}: {
  children: ReactNode
  preloadedUser: Preloaded<typeof api.users.queries.currentUser>
}) {
  const user = usePreloadedQuery(preloadedUser) as CurrentUser | null | undefined
  const provision = useProvisionFlow(user)
  const value = buildContextValue(user, provision)
  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>
}

function CurrentUserProviderClient({ children }: { children: ReactNode }) {
  const ready = useConvexAuthReady()
  const user = useQuery(api.users.queries.currentUser, ready ? {} : "skip") as CurrentUser | null | undefined
  const provision = useProvisionFlow(user)
  const value = buildContextValue(user, provision)
  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>
}

export function CurrentUserProvider({
  children,
  preloadedUser,
}: {
  children: ReactNode
  preloadedUser?: Preloaded<typeof api.users.queries.currentUser>
}) {
  if (preloadedUser) {
    return <CurrentUserProviderPreloaded preloadedUser={preloadedUser}>{children}</CurrentUserProviderPreloaded>
  }
  return <CurrentUserProviderClient>{children}</CurrentUserProviderClient>
}

export function useCurrentUser(): CurrentUserContextValue {
  const ctx = useContext(CurrentUserContext)
  if (!ctx) {
    throw new Error("useCurrentUser must be used within CurrentUserProvider")
  }
  return ctx
}
