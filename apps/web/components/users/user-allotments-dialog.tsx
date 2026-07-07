"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Id } from "@/convex/_generated/dataModel";
import { useSetUserAllotments, useUserAllotments } from "@/hooks/rbac/useRbac";
import { useTenantCatalog } from "@/hooks/users/useUsers";
import { parseConvexError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { Building2, Layers, MapPin, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ─── types ────────────────────────────────────────────────────────────────────

type DraftRow = {
  id: string;
  scope: "ulb" | "district";
  districtId: Id<"districts"> | "";
  municipalityId: Id<"municipalities"> | "";
  isActive: boolean;
};

type AllotmentUser = { _id: Id<"users">; name: string; role: string };

type AllotmentPayload = {
  isActive: boolean;
  districtId?: Id<"districts">;
  municipalityId?: Id<"municipalities">;
};

type ExistingAllotment = {
  _id: Id<"userAllotments">;
  districtId?: Id<"districts">;
  municipalityId?: Id<"municipalities">;
  isActive: boolean;
};

type TenantCatalog = NonNullable<ReturnType<typeof useTenantCatalog>>;

// ─── helpers ──────────────────────────────────────────────────────────────────

function mapAllotmentsToDraftRows(existing: ExistingAllotment[]): DraftRow[] {
  return existing.map((a) => ({
    id: a._id,
    scope: a.municipalityId ? "ulb" : "district",
    districtId: a.districtId ?? ("" as const),
    municipalityId: a.municipalityId ?? ("" as const),
    isActive: a.isActive,
  }));
}

function buildAllotmentPayload(rows: DraftRow[]): AllotmentPayload[] {
  const payload: AllotmentPayload[] = [];
  for (const r of rows) {
    if (r.scope === "ulb" && r.municipalityId) {
      payload.push({ isActive: r.isActive, municipalityId: r.municipalityId });
    } else if (r.scope === "district" && r.districtId) {
      payload.push({ isActive: r.isActive, districtId: r.districtId });
    }
  }
  return payload;
}

// ─── single allotment card ────────────────────────────────────────────────────

function AllotmentCard({
  row,
  idx,
  catalog,
  onChange,
  onRemove,
}: {
  row: DraftRow;
  idx: number;
  catalog: TenantCatalog | undefined;
  onChange: (idx: number, patch: Partial<DraftRow>) => void;
  onRemove: (idx: number) => void;
}) {
  const district = catalog?.find((d) => d._id === row.districtId);
  const ulbs = district?.ulbs ?? [];
  const municipality = ulbs.find((m) => m._id === row.municipalityId);

  // resolved label shown in header
  const locationName =
    row.scope === "district" ? (district?.name ?? null) : (municipality?.name ?? district?.name ?? null);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border transition-all",
        row.isActive
          ? "border-border bg-card shadow-sm"
          : "border-dashed border-muted-foreground/30 bg-muted/10 opacity-70",
        row.scope === "ulb" ? "border-l-[3px] border-l-blue-500" : "border-l-[3px] border-l-teal-500",
      )}
    >
      {/* ── card header ── */}
      <div
        className={cn(
          "flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3",
          row.isActive ? "bg-muted/25" : "bg-muted/10",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
              row.isActive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            {idx + 1}
          </span>

          {row.scope === "ulb" ? (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
              <Building2 className="h-3 w-3" /> ULB
            </span>
          ) : (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-[10px] font-semibold text-teal-700 dark:bg-teal-500/20 dark:text-teal-400">
              <MapPin className="h-3 w-3" /> District
            </span>
          )}

          {locationName ? (
            <span className="truncate text-sm font-medium text-foreground">{locationName}</span>
          ) : (
            <span className="truncate text-sm text-muted-foreground">Not configured</span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Switch
            checked={row.isActive}
            onCheckedChange={(c) => onChange(idx, { isActive: c })}
            className="data-[state=checked]:bg-emerald-500"
          />
          <span
            className={cn(
              "hidden min-w-12 text-[11px] font-medium sm:inline",
              row.isActive ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
            )}
          >
            {row.isActive ? "Active" : "Inactive"}
          </span>
          <button
            type="button"
            onClick={() => onRemove(idx)}
            aria-label="Remove allotment"
            className="rounded-md p-1.5 text-muted-foreground/50 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── selectors ── */}
      <div
        className={cn(
          "grid gap-3 px-4 py-3.5",
          row.scope === "ulb" ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2",
        )}
      >
        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Scope</Label>
          <Select
            value={row.scope}
            onValueChange={(v: "ulb" | "district") => onChange(idx, { scope: v, municipalityId: "" as const })}
          >
            <SelectTrigger className="h-9 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ulb">
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-3 w-3 text-blue-500" /> ULB (city)
                </span>
              </SelectItem>
              <SelectItem value="district">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-teal-500" /> Whole district
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">District</Label>
          <Select
            value={row.districtId}
            onValueChange={(v) =>
              onChange(idx, {
                districtId: v as Id<"districts">,
                municipalityId: "" as const,
              })
            }
          >
            <SelectTrigger className="h-9 w-full text-xs">
              <SelectValue placeholder="Select district…" />
            </SelectTrigger>
            <SelectContent>
              {(catalog ?? []).map((d) => (
                <SelectItem key={d._id} value={d._id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {row.scope === "ulb" && (
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Municipality</Label>
            <Select
              value={row.municipalityId}
              onValueChange={(v) => onChange(idx, { municipalityId: v as Id<"municipalities"> })}
            >
              <SelectTrigger className="h-9 w-full text-xs">
                <SelectValue placeholder="Select ULB…" />
              </SelectTrigger>
              <SelectContent>
                {ulbs.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">Select a district first</div>
                ) : (
                  ulbs.map((m) => (
                    <SelectItem key={m._id} value={m._id}>
                      {m.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── form ─────────────────────────────────────────────────────────────────────

function UserAllotmentsForm({
  user,
  initialRows,
  catalog,
  onOpenChange,
}: {
  user: AllotmentUser;
  initialRows: DraftRow[];
  catalog: TenantCatalog | undefined;
  onOpenChange: (o: boolean) => void;
}) {
  const setAllotments = useSetUserAllotments();
  const [rows, setRows] = useState(initialRows);
  const [busy, setBusy] = useState(false);

  function addRow(scope: "ulb" | "district") {
    const firstDistrict = catalog?.[0]?._id ?? ("" as const);
    setRows((r) => [
      ...r,
      {
        id: `new-${Date.now()}`,
        scope,
        districtId: firstDistrict,
        municipalityId: "" as const,
        isActive: true,
      },
    ]);
  }

  function updateRow(idx: number, patch: Partial<DraftRow>) {
    setRows((all) => all.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function removeRow(idx: number) {
    setRows((all) => all.filter((_, i) => i !== idx));
  }

  async function save() {
    setBusy(true);
    try {
      await setAllotments({ userId: user._id, allotments: buildAllotmentPayload(rows) });
      toast.success("Allotments saved — effective immediately");
      onOpenChange(false);
    } catch (e) {
      toast.error(parseConvexError(e).message);
    } finally {
      setBusy(false);
    }
  }

  const activeCount = rows.filter((r) => r.isActive).length;
  const inactiveCount = rows.length - activeCount;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-muted/20 px-6 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {rows.length > 0 ? (
            <>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {activeCount} active
              </span>
              {inactiveCount > 0 && (
                <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                  {inactiveCount} inactive
                </span>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No allotments yet — add one below</p>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-500/10"
            onClick={() => addRow("ulb")}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">ULB</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 border-teal-200 text-teal-700 hover:bg-teal-50 hover:text-teal-800 dark:border-teal-800 dark:text-teal-400 dark:hover:bg-teal-500/10"
            onClick={() => addRow("district")}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">District</span>
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className="space-y-3 px-6 py-4">
          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-muted-foreground/25 bg-muted/10 px-6 py-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Layers className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">No allotments assigned</p>
              <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
                Assign districts or ULB cities this user can access. Inactive rows keep history but remove access.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => addRow("ulb")}>
                  <Building2 className="h-3.5 w-3.5" />
                  Add ULB city
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => addRow("district")}
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Add district
                </Button>
              </div>
            </div>
          ) : (
            rows.map((row, idx) => (
              <AllotmentCard
                key={row.id}
                row={row}
                idx={idx}
                catalog={catalog}
                onChange={updateRow}
                onRemove={removeRow}
              />
            ))
          )}
        </div>
      </div>

      <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none border-t border-border bg-muted/20 px-6 py-4 sm:justify-between">
        <p className="text-xs text-muted-foreground sm:mr-auto">
          {rows.length === 0 ? "No allotments" : `${rows.length} allotment${rows.length !== 1 ? "s" : ""} total`}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save allotments"}
          </Button>
        </div>
      </DialogFooter>
    </div>
  );
}

// ─── dialog ───────────────────────────────────────────────────────────────────

export function UserAllotmentsDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  user: AllotmentUser | null;
}) {
  const catalog = useTenantCatalog();
  const existing = useUserAllotments(open && user ? user._id : undefined);

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex! h-[min(90vh,760px)] w-full max-w-2xl min-h-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 py-4 pr-12">
          <DialogTitle className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <Layers className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <span className="block truncate">City allotments</span>
              <span className="block truncate text-sm font-normal text-muted-foreground">{user.name}</span>
            </div>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Assign multiple districts or ULBs. Inactive rows keep history but remove access.
          </DialogDescription>
        </DialogHeader>

        {existing === undefined ? (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain px-6 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : (
          <UserAllotmentsForm
            key={user._id}
            user={user}
            initialRows={mapAllotmentsToDraftRows(existing)}
            catalog={catalog}
            onOpenChange={onOpenChange}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
