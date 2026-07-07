"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoleSelectItems } from "@/components/users/role-select-items";
import { TenantScopeFields } from "@/components/users/tenant-scope-fields";
import { UserSheetFooter, UserSheetHero, UserWorkspaceSection } from "@/components/users/user-sheet-layout";
import type { Id } from "@/convex/_generated/dataModel";
import { useAssignableRoles, useSetUserAllotments, useUserAllotments } from "@/hooks/rbac/useRbac";
import { useHasCapability } from "@/hooks/use-capability";
import {
  useApproveUser,
  useAssignTenant,
  useRejectUser,
  useTenantCatalog,
  useUpdateUser,
} from "@/hooks/users/useUsers";
import { parseConvexError } from "@/lib/errors";
import { isDistrictScopedRole, isSystemRoleKey, roleRequiresTenancy } from "@/lib/tenancy-ui";
import { tenantScopeIsComplete, tenantScopeToApproveArgs, type TenantScopeValue } from "@/lib/users/tenant-scope";
import { cn } from "@/lib/utils";
import {
  Ban,
  Building2,
  ChevronRight,
  Layers,
  MapPin,
  MessageSquare,
  Shield,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserX,
} from "lucide-react";
import { useReducer, useState } from "react";
import { toast } from "sonner";
import { UserAllotmentsDialog } from "./user-allotments-dialog";

// ─── exported types ───────────────────────────────────────────────────────────

export type SheetPendingUser = {
  kind: "pending";
  _id: Id<"users">;
  name: string;
  email: string;
  requestedRole?: string;
  requestedReason?: string;
  createdAt: number;
};

export type SheetListedUser = {
  kind: "listed";
  _id: Id<"users">;
  name: string;
  email: string;
  role: string;
  status: string;
  municipalityId?: Id<"municipalities"> | null;
  municipalityName?: string | null;
  wardAssignments?: string[] | null;
  createdAt: number;
};

export type SheetUser = SheetPendingUser | SheetListedUser;

// ─── approve pending panel ────────────────────────────────────────────────────

function ApprovePendingPanel({ user, onClose }: { user: SheetPendingUser; onClose: () => void }) {
  const approve = useApproveUser();
  const reject = useRejectUser();
  const roleCatalog = useAssignableRoles({ includeInactive: false });
  const catalog = useTenantCatalog();

  const activeRoles = (roleCatalog ?? []).filter((r) => r.isActive && r.key !== "pending");

  const preferredRole =
    user.requestedRole &&
    activeRoles.some((r) => r.key === user.requestedRole && (r.isSystem || isSystemRoleKey(r.key)))
      ? user.requestedRole
      : isDistrictScopedRole(user.requestedRole ?? "")
        ? user.requestedRole!
        : "surveyor";

  const [role, setRole] = useState<string>(preferredRole);
  const [tenantScope, setTenantScope] = useState<TenantScopeValue>({
    scope: isDistrictScopedRole(preferredRole) ? "district" : "ulb",
    districtId: catalog?.[0]?._id ?? "",
    municipalityId: "",
    wards: [],
  });
  const [busy, setBusy] = useState(false);

  const roleRow = activeRoles.find((r) => r.key === role);
  const needsTenancy = roleRequiresTenancy(role, roleRow?.permissionKeys);
  const canApprove = !needsTenancy || tenantScopeIsComplete(tenantScope);

  async function onApprove() {
    setBusy(true);
    try {
      await approve({
        userId: user._id,
        role: role as never,
        ...tenantScopeToApproveArgs(tenantScope),
      });
      toast.success(`${user.name} approved as ${role}`);
      onClose();
    } catch (e) {
      toast.error(parseConvexError(e).message);
    } finally {
      setBusy(false);
    }
  }

  async function onReject() {
    if (!confirm(`Reject ${user.name}? Their account will be disabled.`)) return;
    setBusy(true);
    try {
      await reject({ userId: user._id });
      toast.success("User rejected");
      onClose();
    } catch (e) {
      toast.error(parseConvexError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 px-4 py-4 sm:px-5">
          {(user.requestedRole || user.requestedReason) && (
            <UserWorkspaceSection
              title="Sign-up request"
              description="What the applicant asked for"
              icon={MessageSquare}
              className="border-amber-200/60 bg-amber-50/40 dark:border-amber-500/25 dark:bg-amber-500/5"
            >
              {user.requestedRole && (
                <p className="mb-2 text-sm text-muted-foreground">
                  Requested role: <span className="font-medium capitalize text-foreground">{user.requestedRole}</span>
                </p>
              )}
              {user.requestedReason && (
                <blockquote className="rounded-lg border border-amber-200/50 bg-background/60 px-3 py-2 text-sm italic text-foreground/90 dark:border-amber-500/20">
                  &ldquo;{user.requestedReason}&rdquo;
                </blockquote>
              )}
            </UserWorkspaceSection>
          )}

          <UserWorkspaceSection
            title="Assign role"
            description="Prefer system roles — Supervisor for QC leads"
            icon={Shield}
            delay={0.04}
          >
            <Select
              value={role}
              onValueChange={(v) => {
                setRole(v);
                setTenantScope((s) => ({
                  ...s,
                  scope: isDistrictScopedRole(v) ? "district" : "ulb",
                  municipalityId: "",
                  wards: [],
                }));
              }}
            >
              <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <RoleSelectItems roles={activeRoles} />
              </SelectContent>
            </Select>
            <p className="mt-2.5 flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              Custom roles are for exceptional permission sets only. Use{" "}
              <strong className="font-medium text-foreground">Supervisor</strong> for district or multi-ULB QC.
            </p>
          </UserWorkspaceSection>

          {needsTenancy && (
            <UserWorkspaceSection
              title="Tenant scope"
              description="District, ULB, and optional ward limits"
              icon={MapPin}
              delay={0.08}
            >
              <TenantScopeFields
                value={tenantScope}
                onChange={(patch) => setTenantScope((s) => ({ ...s, ...patch }))}
                wardHint={
                  isDistrictScopedRole(role)
                    ? "Optional — limit QC review to specific wards inside the ULB."
                    : undefined
                }
              />
            </UserWorkspaceSection>
          )}
        </div>
      </ScrollArea>

      <UserSheetFooter hint="Review role and scope before approving">
        <Button
          variant="outline"
          className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
          onClick={onReject}
          disabled={busy}
        >
          <UserX className="h-4 w-4" aria-hidden />
          Reject
        </Button>
        <Button
          className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
          onClick={onApprove}
          disabled={busy || !canApprove}
        >
          <UserCheck className="h-4 w-4" aria-hidden />
          {busy ? "Approving…" : "Approve user"}
        </Button>
      </UserSheetFooter>
    </>
  );
}

// ─── edit listed user panel ───────────────────────────────────────────────────

function resolveInitialTenantScope(
  user: SheetListedUser,
  catalog: ReturnType<typeof useTenantCatalog>,
): TenantScopeValue {
  let districtId = "";
  if (user.municipalityId && catalog) {
    for (const d of catalog) {
      if (d.ulbs.some((m) => m._id === user.municipalityId)) {
        districtId = d._id;
        break;
      }
    }
  }
  return {
    scope: user.municipalityId ? "ulb" : "district",
    districtId: districtId || catalog?.[0]?._id || "",
    municipalityId: user.municipalityId ?? "",
    wards: user.wardAssignments ?? [],
  };
}

type EditListedState = {
  role: string;
  tenantScope: TenantScopeValue;
  busy: boolean;
  allotDialogOpen: boolean;
  tab: "access" | "allotments";
};

type EditListedAction =
  | { type: "set_role"; role: string }
  | { type: "patch_tenant_scope"; patch: Partial<TenantScopeValue> }
  | { type: "set_busy"; busy: boolean }
  | { type: "set_allot_dialog"; open: boolean }
  | { type: "set_tab"; tab: "access" | "allotments" };

function initEditListedState({
  user,
  catalog,
}: {
  user: SheetListedUser;
  catalog: ReturnType<typeof useTenantCatalog>;
}): EditListedState {
  return {
    role: user.role,
    tenantScope: resolveInitialTenantScope(user, catalog),
    busy: false,
    allotDialogOpen: false,
    tab: "access",
  };
}

function editListedReducer(state: EditListedState, action: EditListedAction): EditListedState {
  switch (action.type) {
    case "set_role": {
      if (action.role === "admin") return { ...state, role: action.role };
      return {
        ...state,
        role: action.role,
        tenantScope: {
          ...state.tenantScope,
          scope: isDistrictScopedRole(action.role) ? "district" : "ulb",
          municipalityId: "",
          wards: [],
        },
      };
    }
    case "patch_tenant_scope":
      return { ...state, tenantScope: { ...state.tenantScope, ...action.patch } };
    case "set_busy":
      return { ...state, busy: action.busy };
    case "set_allot_dialog":
      return { ...state, allotDialogOpen: action.open };
    case "set_tab":
      return { ...state, tab: action.tab };
    default:
      return state;
  }
}

function AllotmentSummaryCard({ userId, onManage }: { userId: Id<"users">; onManage: () => void }) {
  const allotments = useUserAllotments(userId);
  const active = (allotments ?? []).filter((a) => a.isActive);
  const districtCount = active.filter((a) => a.districtId && !a.municipalityId).length;
  const ulbCount = active.filter((a) => a.municipalityId).length;

  return (
    <button
      type="button"
      onClick={onManage}
      className="group flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-blue-300/60 bg-linear-to-br from-blue-50/80 to-background p-4 text-left transition-all hover:border-blue-400 hover:shadow-premium-sm dark:border-blue-500/30 dark:from-blue-500/10 dark:to-background"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600 ring-1 ring-blue-200/60 dark:bg-blue-500/20 dark:text-blue-400 dark:ring-blue-500/30">
          <Layers className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Multi-city allotments</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {allotments === undefined
              ? "Loading…"
              : active.length === 0
                ? "No extra cities — tap to assign districts or ULBs"
                : `${districtCount} district${districtCount !== 1 ? "s" : ""}, ${ulbCount} ULB${ulbCount !== 1 ? "s" : ""} active`}
          </p>
        </div>
      </div>
      <ChevronRight
        className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
        aria-hidden
      />
    </button>
  );
}

function EditListedPanel({ user, onClose }: { user: SheetListedUser; onClose: () => void }) {
  const updateUserMut = useUpdateUser();
  const assignTenantMut = useAssignTenant();
  const setAllotments = useSetUserAllotments();
  const roleCatalog = useAssignableRoles({ includeInactive: false });
  const catalog = useTenantCatalog();
  const canDisableUsers = useHasCapability("users.disable");
  const canChangeRole = useHasCapability("users.approve");
  const canAssignTenant = useHasCapability("users.assignTenant");

  const [{ role, tenantScope, busy, allotDialogOpen, tab }, dispatch] = useReducer(
    editListedReducer,
    { user, catalog },
    initEditListedState,
  );

  const activeRoles = (roleCatalog ?? []).filter((r) => r.isActive && r.key !== "pending");
  const isAdmin = role === "admin";
  const needsTenancy = roleRequiresTenancy(role, activeRoles.find((r) => r.key === role)?.permissionKeys);

  const initialScope = resolveInitialTenantScope(user, catalog);
  const roleChanged = role !== user.role;
  const scopeChanged =
    tenantScope.scope !== initialScope.scope ||
    tenantScope.districtId !== initialScope.districtId ||
    tenantScope.municipalityId !== initialScope.municipalityId ||
    tenantScope.wards.toSorted().join() !== initialScope.wards.toSorted().join();
  const dirty = roleChanged || scopeChanged;
  const canSave =
    (roleChanged && canChangeRole) || (scopeChanged && canAssignTenant) || (!roleChanged && !scopeChanged && dirty);

  async function onToggleStatus() {
    if (!canDisableUsers) return;
    const next = user.status === "active" ? "disabled" : "active";
    if (!confirm(`${next === "disabled" ? "Disable" : "Enable"} ${user.name}?`)) return;
    dispatch({ type: "set_busy", busy: true });
    try {
      await updateUserMut({ userId: user._id, status: next as "active" | "disabled" });
      toast.success(`User ${next === "disabled" ? "disabled" : "enabled"}`);
      onClose();
    } catch (e) {
      toast.error(parseConvexError(e).message);
    } finally {
      dispatch({ type: "set_busy", busy: false });
    }
  }

  async function onSave() {
    if (roleChanged && !canChangeRole) {
      toast.error("You don't have permission to change roles.");
      return;
    }
    if (scopeChanged && !canAssignTenant) {
      toast.error("You don't have permission to change tenant scope.");
      return;
    }
    dispatch({ type: "set_busy", busy: true });
    try {
      const jobs: Promise<unknown>[] = [];

      if (roleChanged && canChangeRole) {
        jobs.push(updateUserMut({ userId: user._id, role: role as never }));
      }
      if (!isAdmin && scopeChanged && canAssignTenant) {
        if (tenantScope.scope === "ulb" && tenantScope.municipalityId) {
          jobs.push(
            assignTenantMut({
              userId: user._id,
              municipalityId: tenantScope.municipalityId as Id<"municipalities">,
              wardAssignments: tenantScope.wards,
            }),
          );
        } else if (tenantScope.scope === "district" && tenantScope.districtId) {
          jobs.push(
            setAllotments({
              userId: user._id,
              allotments: [{ districtId: tenantScope.districtId as Id<"districts">, isActive: true }],
            }),
          );
        }
      }

      await Promise.all(jobs);
      toast.success("User updated");
      onClose();
    } catch (e) {
      toast.error(parseConvexError(e).message);
    } finally {
      dispatch({ type: "set_busy", busy: false });
    }
  }

  return (
    <>
      <Tabs
        value={tab}
        onValueChange={(value) => dispatch({ type: "set_tab", tab: value as "access" | "allotments" })}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="shrink-0 border-b border-border/60 px-4 pt-2 sm:px-5">
          <TabsList className="grid h-10 w-full grid-cols-2 rounded-xl bg-muted/50 p-1">
            <TabsTrigger value="access" className="cursor-pointer rounded-lg text-xs sm:text-sm">
              Access & role
            </TabsTrigger>
            <TabsTrigger
              value="allotments"
              className="cursor-pointer rounded-lg text-xs sm:text-sm"
              disabled={isAdmin || !canAssignTenant}
            >
              Allotments
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <TabsContent value="access" className="mt-0 space-y-4 px-4 py-4 sm:px-5">
            <UserWorkspaceSection
              title="Account status"
              description="Enable or disable platform access"
              icon={ShieldCheck}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl",
                      user.status === "active"
                        ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                        : "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400",
                    )}
                  >
                    {user.status === "active" ? (
                      <UserCheck className="h-5 w-5" aria-hidden />
                    ) : (
                      <Ban className="h-5 w-5" aria-hidden />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {user.status === "active" ? "Active account" : "Disabled account"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {user.status === "active"
                        ? "User can sign in and work within their scope"
                        : "Sign-in is blocked until re-enabled"}
                    </p>
                  </div>
                </div>
                {user.role !== "admin" && canDisableUsers && (
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn(
                      "h-9 shrink-0 rounded-xl",
                      user.status === "active"
                        ? "border-destructive/40 text-destructive hover:bg-destructive/10"
                        : "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-600 dark:text-emerald-400",
                    )}
                    onClick={onToggleStatus}
                    disabled={busy}
                  >
                    {user.status === "active" ? (
                      <>
                        <Ban className="h-3.5 w-3.5" aria-hidden /> Disable
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Enable
                      </>
                    )}
                  </Button>
                )}
              </div>
            </UserWorkspaceSection>

            <UserWorkspaceSection title="Role" description="System or custom permission set" icon={Shield} delay={0.04}>
              <Select
                value={role}
                onValueChange={(v) => dispatch({ type: "set_role", role: v })}
                disabled={!canChangeRole}
              >
                <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <RoleSelectItems roles={activeRoles} />
                </SelectContent>
              </Select>
              {!canChangeRole && (
                <p className="mt-2 text-xs text-muted-foreground">Only administrators can change user roles.</p>
              )}
            </UserWorkspaceSection>

            {!isAdmin && needsTenancy && canAssignTenant && (
              <UserWorkspaceSection
                title="Primary tenant scope"
                description="Main district, ULB, and ward assignment"
                icon={MapPin}
                delay={0.08}
              >
                <TenantScopeFields
                  value={tenantScope}
                  onChange={(patch) => dispatch({ type: "patch_tenant_scope", patch })}
                  wardHint={
                    isDistrictScopedRole(role)
                      ? "Optional ward limits for QC supervisors within the selected ULB."
                      : undefined
                  }
                />
                {user.municipalityName && (
                  <p className="mt-3 flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground ring-1 ring-border/50">
                    <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Saved primary ULB: <span className="font-medium text-foreground">{user.municipalityName}</span>
                  </p>
                )}
              </UserWorkspaceSection>
            )}
          </TabsContent>

          <TabsContent value="allotments" className="mt-0 space-y-4 px-4 py-4 sm:px-5">
            <UserWorkspaceSection
              title="Geographic allotments"
              description="Assign multiple districts or ULBs beyond the primary scope"
              icon={Layers}
            >
              <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                Use this when a supervisor spans several cities (e.g. Agra + Mathura). Inactive rows keep history but
                remove access immediately.
              </p>
              <AllotmentSummaryCard
                userId={user._id}
                onManage={() => dispatch({ type: "set_allot_dialog", open: true })}
              />
            </UserWorkspaceSection>
          </TabsContent>
        </ScrollArea>
      </Tabs>

      <UserSheetFooter dirty={dirty && canSave}>
        <Button variant="outline" size="sm" className="rounded-xl" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        {canSave && (
          <Button size="sm" className="rounded-xl" onClick={onSave} disabled={busy || !dirty}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        )}
      </UserSheetFooter>

      {!isAdmin && (
        <UserAllotmentsDialog
          open={allotDialogOpen}
          onOpenChange={(open) => dispatch({ type: "set_allot_dialog", open })}
          user={{ _id: user._id, name: user.name, role: user.role }}
        />
      )}
    </>
  );
}

// ─── main exported sheet ──────────────────────────────────────────────────────

export function UserEditSheet({ user, onClose }: { user: SheetUser | null; onClose: () => void }) {
  return (
    <Sheet open={!!user} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl" showCloseButton>
        {user && (
          <>
            <SheetHeader className="sr-only">
              <SheetTitle>{user.kind === "pending" ? `Approve ${user.name}` : `Edit ${user.name}`}</SheetTitle>
            </SheetHeader>
            <UserSheetHero
              name={user.name}
              email={user.email}
              role={user.kind === "listed" ? user.role : null}
              status={user.kind === "listed" ? user.status : null}
              createdAt={user.createdAt}
              pending={user.kind === "pending"}
            />

            {user.kind === "pending" ? (
              <ApprovePendingPanel user={user} onClose={onClose} />
            ) : (
              <EditListedPanel key={user._id} user={user} onClose={onClose} />
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
