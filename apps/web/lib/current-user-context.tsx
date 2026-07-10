"use client"

import { useConvexAuthReady } from "@/hooks/use-convex-auth-ready"
import { parseConvexError } from "@/lib/errors"
import type { Role } from "@/lib/permissions"
import { api } from "@workspace/backend/convex/_generated/api.js"
import { useMutation, usePreloadedQuery, useQuery, type Preloaded } from "convex/react"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"

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
  provisionFailureCode: string | null
  retryProvision: () => void
  isActive: boolean
  isPending: boolean
  isDisabled: boolean
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null)

function useProvisionFlow(user: CurrentUser | null | undefined) {
  const ready = useConvexAuthReady()
  const provision = useMutation(api.users.mutations.provisionCurrentUser)
  const provisioned = useRef(false)
  const [provisionFailed, setProvisionFailed] = useState(false)
  const [provisionFailureCode, setProvisionFailureCode] = useState<string | null>(null)
  const [isProvisioning, setIsProvisioning] = useState(false)

  const runProvision = useCallback(async () => {
    setIsProvisioning(true)
    setProvisionFailed(false)
    setProvisionFailureCode(null)
    try {
      await provision({})
    } catch (error) {
      const { code } = parseConvexError(error)
      setProvisionFailed(true)
      setProvisionFailureCode(code)
      provisioned.current = false
    } finally {
      setIsProvisioning(false)
    }
  }, [provision])

  useEffect(() => {
    if (!ready) {
      provisioned.current = false
      setProvisionFailed(false)
      setProvisionFailureCode(null)
      return
    }
    if (user === null && !provisioned.current && !isProvisioning) {
      provisioned.current = true
      void runProvision()
    }
  }, [ready, user, isProvisioning, runProvision])

  const retryProvision = useCallback(() => {
    if (!ready) return
    provisioned.current = true
    void runProvision()
  }, [ready, runProvision])

  return {
    ready,
    isProvisioning: ready && user === null && (isProvisioning || !provisionFailed),
    provisionFailed: ready && user === null && provisionFailed,
    provisionFailureCode: provisionFailed ? provisionFailureCode : null,
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
    isLoading: user === undefined || (user === null && !provision.ready),
    isProvisioning: provision.isProvisioning,
    provisionFailed: provision.provisionFailed,
    provisionFailureCode: provision.provisionFailureCode,
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
  const value = useMemo(() => buildContextValue(user, provision), [user, provision])
  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>
}

function CurrentUserProviderClient({ children }: { children: ReactNode }) {
  const ready = useConvexAuthReady()
  const user = useQuery(api.users.queries.currentUser, ready ? {} : "skip") as CurrentUser | null | undefined
  const provision = useProvisionFlow(user)
  const value = useMemo(() => buildContextValue(user, provision), [user, provision])
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
