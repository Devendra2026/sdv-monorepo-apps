"use client"

import { PageTransition } from "@/components/design-system/motion"
import { type PermissionOption } from "@/components/rbac/permission-picker"
import { RolesMasterDetail, type RoleRow } from "@/components/rbac/roles-master-detail"
import { RolesHero, RolesMetricsSection } from "@/components/rbac/roles-page-sections"
import { RoleGate } from "@/components/shared/role-gate"
import { useCreateRole, usePermissions, useRoles, useSeedRbac, useUpdateRole } from "@/hooks/rbac/useRbac"
import { parseConvexError } from "@/lib/errors"
import type { Id } from "@workspace/backend/convex/_generated/dataModel.js"
import { useMemo, useState } from "react"
import { toast } from "sonner"

export default function RolesPage() {
  const roles = useRoles({ includeInactive: true })
  const permissions = usePermissions()
  const seedFn = useSeedRbac()
  const createRole = useCreateRole()
  const updateRole = useUpdateRole()

  const [selectedId, setSelectedId] = useState<Id<"roles"> | null>(null)
  const [mode, setMode] = useState<"view" | "edit" | "create">("view")
  const [search, setSearch] = useState("")
  const [seeding, setSeeding] = useState(false)

  const permissionOptions = useMemo<PermissionOption[]>(
    () => (permissions ?? []).map((p) => ({ key: p.key, label: p.label, category: p.category })),
    [permissions]
  )
  const permissionLabels = useMemo(
    () => new Map((permissions ?? []).map((p) => [p.key, p.label] as const)),
    [permissions]
  )
  const permissionCategories = useMemo(
    () => new Map((permissions ?? []).map((p) => [p.key, p.category] as const)),
    [permissions]
  )

  const sorted = useMemo(() => {
    if (!roles) return undefined
    const q = search.trim().toLowerCase()
    const filtered = q
      ? roles.filter((r) => r.name.toLowerCase().includes(q) || r.key.toLowerCase().includes(q))
      : roles
    return filtered.sort((a, b) => Number(b.isSystem) - Number(a.isSystem) || a.name.localeCompare(b.name))
  }, [roles, search])

  const systemRoles = sorted?.filter((r) => r.isSystem) ?? []
  const customRoles = sorted?.filter((r) => !r.isSystem) ?? []
  const selectedRole = roles?.find((r) => r._id === selectedId)

  function selectRole(id: Id<"roles">) {
    setSelectedId(id)
    setMode("view")
  }

  function startCreate() {
    setSelectedId(null)
    setMode("create")
  }

  async function onSeed() {
    setSeeding(true)
    try {
      await seedFn({})
      toast.success("System roles and permissions refreshed")
    } catch (e) {
      toast.error(parseConvexError(e).message)
    } finally {
      setSeeding(false)
    }
  }

  async function onToggleActive(role: RoleRow) {
    try {
      await updateRole({ roleId: role._id, isActive: !role.isActive })
      toast.success(role.isActive ? "Role deactivated" : "Role activated")
    } catch (e) {
      toast.error(parseConvexError(e).message)
    }
  }

  async function onSaveEdit(patch: { name: string; description: string; permissionKeys: string[] }) {
    if (!selectedRole) return
    try {
      await updateRole({
        roleId: selectedRole._id,
        name: patch.name,
        description: patch.description || undefined,
        permissionKeys: patch.permissionKeys,
      })
      toast.success("Role updated")
      setMode("view")
    } catch (e) {
      toast.error(parseConvexError(e).message)
      throw e
    }
  }

  async function onCreateRole(data: { key: string; name: string; description: string; permissionKeys: string[] }) {
    try {
      const newId = (await createRole({
        key: data.key,
        name: data.name,
        description: data.description || undefined,
        permissionKeys: data.permissionKeys,
      })) as Id<"roles">
      toast.success("Role created")
      setSelectedId(newId)
      setMode("view")
    } catch (e) {
      toast.error(parseConvexError(e).message)
      throw e
    }
  }

  const roleCount = roles?.length ?? 0
  const activeCount = roles?.filter((r) => r.isActive).length ?? 0
  const customCount = roles?.filter((r) => !r.isSystem).length ?? 0
  const permCount = permissions?.length ?? 0

  return (
    <RoleGate
      mode="page"
      capability="roles.manage"
      deniedDescription="Only administrators can manage roles and permissions."
    >
      <PageTransition className="space-y-6 lg:space-y-8">
        <RolesHero onSeed={onSeed} seeding={seeding} />
        <RolesMetricsSection
          roleCount={roleCount}
          activeCount={activeCount}
          customCount={customCount}
          permCount={permCount}
          loaded={roles !== undefined}
        />
        <RolesMasterDetail
          systemRoles={systemRoles}
          customRoles={customRoles}
          selectedId={selectedId}
          mode={mode}
          search={search}
          onSearchChange={setSearch}
          roleCount={roleCount}
          permCount={permCount}
          selectedRole={selectedRole}
          permissionOptions={permissionOptions}
          permissionLabels={permissionLabels}
          permissionCategories={permissionCategories}
          onSelectRole={selectRole}
          onStartCreate={startCreate}
          onSetMode={setMode}
          onToggleActive={onToggleActive}
          onSaveEdit={onSaveEdit}
          onCreateRole={onCreateRole}
        />
        <p className="text-center text-xs text-muted-foreground">
          Permission changes apply reactively when Convex refreshes the signed-in user's session data.
        </p>
      </PageTransition>
    </RoleGate>
  )
}
