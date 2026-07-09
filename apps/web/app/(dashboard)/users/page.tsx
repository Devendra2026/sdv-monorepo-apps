"use client"

import { PageTransition } from "@/components/design-system/motion"
import { RoleGate } from "@/components/shared/role-gate"
import { UserAllotmentsDialog } from "@/components/users/user-allotments-dialog"
import { UserEditSheet, type SheetUser } from "@/components/users/user-edit-sheet"
import {
  UsersHero,
  UsersMetricsSection,
  UsersPendingAlert,
  UsersTenancyGuide,
} from "@/components/users/users-page-sections"
import {
  ALL,
  type AllotUser,
  type ListedUser,
  type UsersListUiAction,
  type UsersListUiState,
} from "@/components/users/users-page-shared"
import { UsersPageTabs } from "@/components/users/users-page-tabs"
import { useAssignableRoles } from "@/hooks/rbac/useRbac"
import { usePendingApprovals, useUserListPaginated, type UserListFilters } from "@/hooks/users/useUsers"
import { useMemo, useReducer, useState } from "react"

function usersListUiReducer(state: UsersListUiState, action: UsersListUiAction): UsersListUiState {
  switch (action.type) {
    case "setRoleFilter":
      return { ...state, roleFilter: action.value }
    case "setStatusFilter":
      return { ...state, statusFilter: action.value }
    case "setPageSize":
      return { ...state, pageSize: action.value }
    case "setSearch":
      return { ...state, search: action.value }
    case "clearFilters":
      return { ...state, roleFilter: ALL, statusFilter: ALL, search: "" }
    default:
      return state
  }
}

export default function UsersPage() {
  const pending = usePendingApprovals()
  const allRoles = useAssignableRoles({ includeInactive: false })
  const [listUi, dispatchListUi] = useReducer(usersListUiReducer, {
    roleFilter: ALL,
    statusFilter: ALL,
    pageSize: 15,
    search: "",
  })
  const { roleFilter, statusFilter, pageSize, search } = listUi
  const [sheetUser, setSheetUser] = useState<SheetUser | null>(null)
  const [allotUser, setAllotUser] = useState<AllotUser | null>(null)

  const listFilters = useMemo((): UserListFilters => {
    const f: UserListFilters = {}
    if (roleFilter !== ALL) f.role = roleFilter as UserListFilters["role"]
    if (statusFilter !== ALL) f.status = statusFilter as UserListFilters["status"]
    return f
  }, [roleFilter, statusFilter])

  const {
    users,
    isLoading,
    pageNumber,
    pageSize: rowsPerPage,
    canGoPrev,
    canGoNext,
    goNext,
    goPrev,
  } = useUserListPaginated(listFilters, pageSize)

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users
    const q = search.toLowerCase()
    return users?.filter((u: ListedUser) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  }, [users, search])

  const activeCount = users?.filter((u: ListedUser) => u.status === "active").length ?? 0
  const disabledCount = users?.filter((u: ListedUser) => u.status === "disabled").length ?? 0

  const directory = {
    filteredUsers,
    allRoles,
    listUi,
    dispatchListUi,
    pagination: {
      pageNumber,
      rowsPerPage,
      canGoPrev,
      canGoNext,
      goPrev,
      goNext,
    },
    loadStatus: isLoading ? ("loading" as const) : ("ready" as const),
    setSheetUser,
    setAllotUser,
  }

  return (
    <RoleGate
      mode="page"
      capability="users.view"
      deniedDescription="User management is restricted to supervisors and administrators."
    >
      <PageTransition className="space-y-6 lg:space-y-8">
        <UsersHero />
        <UsersPendingAlert pending={pending} />
        <UsersMetricsSection pending={pending} users={users} activeCount={activeCount} disabledCount={disabledCount} />
        <UsersTenancyGuide />
        <UsersPageTabs pending={pending} users={users} directory={directory} setSheetUser={setSheetUser} />

        <UserEditSheet user={sheetUser} onClose={() => setSheetUser(null)} />

        <UserAllotmentsDialog open={!!allotUser} onOpenChange={(o) => !o && setAllotUser(null)} user={allotUser} />
      </PageTransition>
    </RoleGate>
  )
}
