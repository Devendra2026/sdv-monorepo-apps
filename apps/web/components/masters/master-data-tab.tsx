"use client";

import { MasterFormDialog, type MasterEditRow } from "@/components/masters/master-form-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/loading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Id } from "@/convex/_generated/dataModel";
import { useDeleteMaster, useMasterCategory, useUpsertMaster } from "@/hooks/masters/useMasterAdmin";
import { MASTER_CATEGORIES, MASTER_CATEGORY_LABELS, type MasterCategory } from "@/lib/domain";
import { parseConvexError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import {
  Building2,
  CalendarDays,
  GripVertical,
  Home,
  Info,
  KeyRound,
  Layers,
  MapPinned,
  Pencil,
  Plus,
  Route,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

type MasterRow = {
  _id?: Id<"masters">;
  value: string;
  label: string;
  position: number;
  isActive: boolean;
};

const CATEGORY_META: Record<
  MasterCategory,
  { icon: React.ElementType; accent: string; ring: string; description: string }
> = {
  assessment_year: {
    icon: CalendarDays,
    accent: "text-blue-600 dark:text-blue-400",
    ring: "ring-blue-500/30 bg-blue-500/10",
    description: "Financial year options shown on survey forms",
  },
  ownership_type: {
    icon: KeyRound,
    accent: "text-violet-600 dark:text-violet-400",
    ring: "ring-violet-500/30 bg-violet-500/10",
    description: "How the property is owned or held",
  },
  property_use_subcategory: {
    icon: Home,
    accent: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/30 bg-emerald-500/10",
    description: "Detailed property type classifications",
  },
  property_use: {
    icon: Building2,
    accent: "text-indigo-600 dark:text-indigo-400",
    ring: "ring-indigo-500/30 bg-indigo-500/10",
    description: "Primary use category for the property",
  },
  situation: {
    icon: MapPinned,
    accent: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/30 bg-amber-500/10",
    description: "Location context relative to landmarks",
  },
  road_type: {
    icon: Route,
    accent: "text-cyan-600 dark:text-cyan-400",
    ring: "ring-cyan-500/30 bg-cyan-500/10",
    description: "Access road classification for valuation",
  },
  tax_rate_zone: {
    icon: Layers,
    accent: "text-rose-600 dark:text-rose-400",
    ring: "ring-rose-500/30 bg-rose-500/10",
    description: "Municipal tax rate zone assignments",
  },
};

function CategoryPicker({ category, onChange }: { category: MasterCategory; onChange: (c: MasterCategory) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {MASTER_CATEGORIES.map((c) => {
        const meta = CATEGORY_META[c];
        const Icon = meta.icon;
        const active = category === c;

        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={cn(
              "group relative flex cursor-pointer flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? cn("border-primary/40 bg-primary/5 shadow-sm ring-2", meta.ring)
                : "border-border/60 bg-card hover:border-primary/25 hover:bg-muted/40",
            )}
          >
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                active ? meta.ring : "bg-muted/60 group-hover:bg-muted",
              )}
            >
              <Icon className={cn("h-4 w-4", active ? meta.accent : "text-muted-foreground")} />
            </div>
            <p className={cn("text-xs font-semibold leading-tight", active && "text-foreground")}>
              {MASTER_CATEGORY_LABELS[c]}
            </p>
          </button>
        );
      })}
    </div>
  );
}

export function MasterDataTab() {
  const [category, setCategory] = useState<MasterCategory>("assessment_year");
  const [search, setSearch] = useState("");
  const rows = useMasterCategory(category);
  const upsert = useUpsertMaster();
  const del = useDeleteMaster();
  const [editing, setEditing] = useState<MasterEditRow | null>(null);

  const meta = CATEGORY_META[category];
  const CategoryIcon = meta.icon;

  const handleCategoryChange = useCallback((next: MasterCategory) => {
    setCategory(next);
    setSearch("");
  }, []);

  const filteredRows = useMemo(() => {
    if (!rows) return undefined;
    const q = search.trim().toLowerCase();
    if (!q) return rows as MasterRow[];
    return (rows as MasterRow[]).filter((r) => r.label.toLowerCase().includes(q) || r.value.toLowerCase().includes(q));
  }, [rows, search]);

  const activeCount = rows?.filter((r) => r.isActive).length ?? 0;
  const inactiveCount = (rows?.length ?? 0) - activeCount;

  async function save() {
    if (!editing) return;
    try {
      await upsert({
        category,
        value: editing.value.trim(),
        label: editing.label.trim(),
        position: editing.position,
        isActive: editing.isActive,
      });
      toast.success("Master saved");
      setEditing(null);
    } catch (e) {
      toast.error(parseConvexError(e).message);
    }
  }

  async function toggle(r: MasterRow) {
    try {
      await upsert({ category, value: r.value, label: r.label, position: r.position, isActive: !r.isActive });
    } catch (e) {
      toast.error(parseConvexError(e).message);
    }
  }

  async function remove(r: MasterRow) {
    if (!confirm(`Delete "${r.label}"?`)) return;
    try {
      await del({ id: r._id! });
      toast.success("Deleted");
    } catch (e) {
      toast.error(parseConvexError(e).message);
    }
  }

  return (
    <div className="space-y-5">
      <CategoryPicker category={category} onChange={handleCategoryChange} />

      <Card className="overflow-hidden border-border/60 shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border/60 bg-linear-to-r from-violet-50/80 to-card px-5 py-4 dark:from-violet-950/30 dark:to-card sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", meta.ring)}>
              <CategoryIcon className={cn("h-5 w-5", meta.accent)} />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">{MASTER_CATEGORY_LABELS[category]}</h2>
              <p className="text-xs text-muted-foreground">{meta.description}</p>
              {rows !== undefined && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-[10px] font-semibold">
                    {rows.length} option{rows.length !== 1 ? "s" : ""}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-emerald-500/30 bg-emerald-500/5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400"
                  >
                    {activeCount} active
                  </Badge>
                  {inactiveCount > 0 && (
                    <Badge variant="secondary" className="text-[10px] font-semibold">
                      {inactiveCount} inactive
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-45 flex-1 sm:flex-none">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search options…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-8 text-sm"
              />
            </div>
            <Button
              size="sm"
              className="h-9 shadow-sm"
              onClick={() => setEditing({ value: "", label: "", position: (rows?.length ?? 0) + 1, isActive: true })}
            >
              <Plus className="h-4 w-4" /> Add option
            </Button>
          </div>
        </div>

        <div className="flex items-start gap-2 border-b border-border/40 bg-muted/20 px-5 py-2.5 dark:bg-muted/10">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Changes sync live to all open survey forms. Edits here are not currently captured in the audit log.
          </p>
        </div>

        <CardContent className="p-0">
          {rows === undefined ? (
            <div className="p-5">
              <TableSkeleton rows={5} />
            </div>
          ) : filteredRows?.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title={search ? "No matching options" : "No options yet"}
                description={
                  search
                    ? "Try a different search term or clear the filter."
                    : "Add the first option for this category."
                }
                icon={CategoryIcon}
                action={
                  !search ? (
                    <Button
                      size="sm"
                      onClick={() =>
                        setEditing({ value: "", label: "", position: (rows?.length ?? 0) + 1, isActive: true })
                      }
                    >
                      <Plus className="h-4 w-4" /> Add option
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setSearch("")}>
                      Clear search
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-12 pl-5 text-[10px] font-bold uppercase tracking-wider">Pos</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-wider">Label</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-wider">Value</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase tracking-wider">Status</TableHead>
                  <TableHead className="w-24 pr-5 text-right text-[10px] font-bold uppercase tracking-wider">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows?.map((r) => (
                  <TableRow key={r._id ?? r.value} className="group transition-colors hover:bg-muted/30">
                    <TableCell className="pl-5">
                      <div className="flex items-center gap-1.5">
                        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-muted/60 px-1.5 text-xs font-semibold tabular-nums text-muted-foreground">
                          {r.position}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{r.label}</TableCell>
                    <TableCell>
                      <code className="rounded-md bg-muted/60 px-2 py-0.5 font-mono text-xs text-muted-foreground">
                        {r.value}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Switch checked={r.isActive} onCheckedChange={() => toggle(r)} />
                        <Badge
                          variant={r.isActive ? "default" : "secondary"}
                          className={cn(
                            "text-[10px] font-semibold",
                            r.isActive && "bg-emerald-600 hover:bg-emerald-600 dark:bg-emerald-600",
                          )}
                        >
                          {r.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="pr-5">
                      <div className="flex justify-end gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => setEditing({ ...r, _id: r._id as string | undefined })}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit option</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 hover:bg-destructive/10"
                              disabled={!r._id}
                              onClick={() => remove(r)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Delete option</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <MasterFormDialog row={editing} onChange={setEditing} onSave={save} onClose={() => setEditing(null)} />
    </div>
  );
}
