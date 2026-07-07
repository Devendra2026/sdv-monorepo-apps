"use client"

import { api } from "@workspace/backend/convex/_generated/api.js"
import { useConvexAuthReady } from "@/hooks/use-convex-auth-ready"
import type { Role } from "@/lib/permissions"
import { useMutation, useQuery } from "convex/react"
import { useCallback, useEffect, useRef, useState } from "react"

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

export function useCurrentUser() {
  const ready = useConvexAuthReady()
  const user = useQuery(api.users.queries.currentUser, ready ? {} : "skip") as CurrentUser | null | undefined
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
    // `undefined` = still loading; `null` = authenticated but no domain row yet.
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
    user: user ?? null,
    role: (user?.role ?? undefined) as Role | undefined,
    capabilities: user?.capabilities,
    roleName: user?.roleName,
    isLoading: user === undefined,
    isProvisioning: user === null && (isProvisioning || !provisionFailed),
    provisionFailed: user === null && provisionFailed,
    retryProvision,
    isActive: user?.status === "active",
    isPending: user?.status === "pending_approval",
    isDisabled: user?.status === "disabled",
  }
}
