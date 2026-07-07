import type { SheetListedUser, SheetPendingUser, SheetUser } from "@/components/users/user-edit-sheet";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { roleRequiresTenancy } from "@/lib/tenancy-ui";
import type { FunctionReturnType } from "convex/server";
import type { Dispatch } from "react";

export type PendingUser = FunctionReturnType<typeof api.admin.listPendingApprovals>[number];
export type ListedUser = FunctionReturnType<typeof api.admin.listUsers>["page"][number];
export type RoleRow = FunctionReturnType<typeof api.rbac.listAssignableRoles>[number];
export type AllotUser = { _id: Id<"users">; name: string; role: string };

export type UsersListUiState = {
  roleFilter: string;
  statusFilter: string;
  pageSize: number;
  search: string;
};

export type UsersListUiAction =
  | { type: "setRoleFilter"; value: string }
  | { type: "setStatusFilter"; value: string }
  | { type: "setPageSize"; value: number }
  | { type: "setSearch"; value: string }
  | { type: "clearFilters" };

export type UsersDirectoryPagination = {
  pageNumber: number;
  rowsPerPage: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  goPrev: () => void;
  goNext: () => void;
};

export type UsersDirectoryLoadStatus = "loading" | "ready";

export const ALL = "__all__";

export function usersListHasActiveFilters(listUi: UsersListUiState) {
  return listUi.roleFilter !== ALL || listUi.statusFilter !== ALL || listUi.search.trim().length > 0;
}

export type UsersDirectoryTabModel = {
  filteredUsers: ListedUser[] | undefined;
  allRoles: RoleRow[] | undefined;
  listUi: UsersListUiState;
  dispatchListUi: Dispatch<UsersListUiAction>;
  pagination: UsersDirectoryPagination;
  loadStatus: UsersDirectoryLoadStatus;
  setSheetUser: (user: SheetUser) => void;
  setAllotUser: (user: AllotUser) => void;
};

const AVATAR_PALETTE = [
  "bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-pink-100 text-pink-700",
  "bg-cyan-100 text-cyan-700",
  "bg-orange-100 text-orange-700",
  "bg-indigo-100 text-indigo-700",
];

export const ROLE_COLORS: Record<string, string> = {
  admin:
    "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-500/30",
  supervisor:
    "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30",
  qc_supervisor:
    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-500/30",
  surveyor:
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30",
  pending:
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
};

export const ROLE_DOT: Record<string, string> = {
  admin: "bg-violet-500",
  supervisor: "bg-blue-500",
  qc_supervisor: "bg-amber-500",
  surveyor: "bg-emerald-500",
  pending: "bg-amber-500",
};

export const STATUS_COLORS: Record<string, string> = {
  active:
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30",
  pending_approval:
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
  disabled: "bg-red-100 text-red-600 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-500/30",
};

export function avatarColor(name: string) {
  return AVATAR_PALETTE[name.charCodeAt(0) % AVATAR_PALETTE.length];
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function toPendingSheet(u: PendingUser): SheetPendingUser {
  return {
    kind: "pending",
    _id: u._id as Id<"users">,
    name: u.name,
    email: u.email,
    requestedRole: u.requestedRole ?? undefined,
    requestedReason: u.requestedReason ?? undefined,
    createdAt: u.createdAt,
  };
}

export function toListedSheet(u: ListedUser): SheetListedUser {
  return {
    kind: "listed",
    _id: u._id as Id<"users">,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    municipalityId: u.municipalityId as Id<"municipalities"> | null | undefined,
    municipalityName: u.municipalityName,
    wardAssignments: u.wardAssignments,
    createdAt: u.createdAt,
  };
}

export function isFieldRole(role: string, roles?: RoleRow[]) {
  const row = roles?.find((r) => r.key === role);
  if (row) return roleRequiresTenancy(role, row.permissionKeys);
  return role === "supervisor" || role === "qc_supervisor" || role === "surveyor";
}

export function pendingAge(createdAt: number) {
  const days = Math.floor((Date.now() - createdAt) / 86_400_000);
  if (days === 0) return { label: "Today", urgent: false };
  if (days === 1) return { label: "Yesterday", urgent: false };
  if (days <= 3) return { label: `${days}d ago`, urgent: false };
  return { label: `${days}d ago`, urgent: true };
}
