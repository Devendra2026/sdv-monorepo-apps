"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTenantCatalog } from "@/hooks/users/useUsers";
import type { TenantScopeValue } from "@/lib/users/tenant-scope";
import { cn } from "@/lib/utils";
import { Building2, Check, MapPin, Search } from "lucide-react";
import { useMemo, useState } from "react";

type Ward = { _id: string; wardNo: string };

const SCOPE_TYPE_OPTIONS = [
  {
    id: "ulb" as const,
    icon: Building2,
    title: "Single ULB",
    description: "One city municipality",
    accent: "border-blue-500/40 bg-blue-50/80 dark:bg-blue-500/10",
    iconClass: "text-blue-600 dark:text-blue-400",
  },
  {
    id: "district" as const,
    icon: MapPin,
    title: "Whole district",
    description: "All ULBs in district",
    accent: "border-teal-500/40 bg-teal-50/80 dark:bg-teal-500/10",
    iconClass: "text-teal-600 dark:text-teal-400",
  },
] as const;

function ScopeTypePicker({
  value,
  onChange,
}: {
  value: "ulb" | "district";
  onChange: (scope: "ulb" | "district") => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Tenant scope type">
      {SCOPE_TYPE_OPTIONS.map((opt) => {
        const selected = value === opt.id;
        const Icon = opt.icon;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.id)}
            className={cn(
              "group relative flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-left transition-all duration-200",
              selected
                ? cn("ring-2 ring-primary/25 shadow-premium-sm", opt.accent)
                : "border-border/70 bg-muted/20 hover:border-primary/30 hover:bg-muted/40",
            )}
          >
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background/80 ring-1 ring-border/60",
                opt.iconClass,
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{opt.title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{opt.description}</p>
            </div>
            {selected && (
              <span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-3 w-3" aria-hidden />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function WardPicker({
  wards,
  selected,
  onChange,
  hint,
}: {
  wards: Ward[];
  selected: string[];
  onChange: (v: string[]) => void;
  hint?: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return wards;
    return wards.filter((w) => w.wardNo.toLowerCase().includes(q) || `ward ${w.wardNo}`.includes(q));
  }, [wards, query]);

  if (wards.length === 0) return null;

  const allSelected = selected.length === 0;
  const partial = selected.length > 0;

  function toggle(wardNo: string) {
    onChange(selected.includes(wardNo) ? selected.filter((x) => x !== wardNo) : [...selected, wardNo]);
  }

  function selectAll() {
    onChange([]);
  }

  function selectFiltered() {
    const nums = filtered.map((w) => w.wardNo);
    const merged = new Set([...selected, ...nums]);
    onChange([...merged]);
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-muted/15 p-3.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Label className="text-xs font-semibold text-foreground">Ward limits</Label>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {allSelected
              ? "All wards in this ULB"
              : `${selected.length} of ${wards.length} ward${wards.length !== 1 ? "s" : ""} selected`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {partial && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="cursor-pointer rounded-lg border border-border/70 bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              All wards
            </button>
          )}
          {query && filtered.length > 0 && (
            <button
              type="button"
              onClick={selectFiltered}
              className="cursor-pointer rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
            >
              Select filtered
            </button>
          )}
          {partial && (
            <button
              type="button"
              onClick={selectAll}
              className="cursor-pointer rounded-lg border border-border/70 bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {wards.length > 8 && (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ward number…"
            className="h-9 bg-background/80 pl-8 text-xs"
            aria-label="Search wards"
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5">
        {filtered.map((w) => {
          const on = partial ? selected.includes(w.wardNo) : false;
          const implicitAll = !partial;
          return (
            <button
              key={w._id}
              type="button"
              onClick={() => toggle(w.wardNo)}
              className={cn(
                "flex min-h-9 cursor-pointer items-center justify-center rounded-lg border px-1 text-[11px] font-medium transition-all duration-150",
                implicitAll || on
                  ? "border-primary/50 bg-primary/10 text-primary shadow-sm"
                  : "border-border/70 bg-background text-muted-foreground hover:border-primary/35 hover:text-foreground",
              )}
              aria-pressed={implicitAll || on}
            >
              {w.wardNo.padStart(2, "0")}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="py-2 text-center text-xs text-muted-foreground">No wards match &ldquo;{query}&rdquo;</p>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {hint ??
          (allSelected
            ? "Leave unselected for full ULB access. Pick specific wards to narrow the surveyor or QC scope."
            : "Only selected wards will be visible for this user.")}
      </p>
    </div>
  );
}

export function TenantScopeFields({
  value,
  onChange,
  showWards = true,
  wardHint,
}: {
  value: TenantScopeValue;
  onChange: (patch: Partial<TenantScopeValue>) => void;
  showWards?: boolean;
  wardHint?: string;
}) {
  const catalog = useTenantCatalog();
  const district = catalog?.find((d) => d._id === value.districtId);
  const ulbs = district?.ulbs ?? [];
  const selectedMuni = ulbs.find((m) => m._id === value.municipalityId);
  const wardsForMuni = selectedMuni?.wards ?? [];

  return (
    <div className="space-y-4">
      <ScopeTypePicker
        value={value.scope}
        onChange={(scope) => onChange({ scope, municipalityId: "", wards: scope === "district" ? [] : value.wards })}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">District</Label>
          <Select
            value={value.districtId}
            onValueChange={(v) =>
              onChange({
                districtId: v,
                municipalityId: "",
                wards: [],
              })
            }
          >
            <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl bg-background/80 text-xs">
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

        {value.scope === "ulb" && (
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">ULB</Label>
            <Select value={value.municipalityId} onValueChange={(v) => onChange({ municipalityId: v, wards: [] })}>
              <SelectTrigger className="h-10 w-full cursor-pointer rounded-xl bg-background/80 text-xs">
                <SelectValue placeholder="Select ULB…" />
              </SelectTrigger>
              <SelectContent>
                {ulbs.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">Select a district first</div>
                ) : (
                  ulbs.map((m) => (
                    <SelectItem key={m._id} value={m._id}>
                      <span className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        {m.name}
                        <span className="text-xs text-muted-foreground">({m.code})</span>
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {value.scope === "ulb" && selectedMuni && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground ring-1 ring-border/50">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
          <span className="truncate">
            <span className="font-medium text-foreground">{district?.name}</span>
            <span className="mx-1.5 text-border">/</span>
            <span className="text-foreground">{selectedMuni.name}</span>
          </span>
        </div>
      )}

      {showWards && value.scope === "ulb" && value.municipalityId && (
        <WardPicker
          wards={wardsForMuni}
          selected={value.wards}
          onChange={(wards) => onChange({ wards })}
          hint={wardHint}
        />
      )}
    </div>
  );
}
