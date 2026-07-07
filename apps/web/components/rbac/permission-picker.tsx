"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

export type PermissionOption = {
  key: string;
  label: string;
  category: string;
};

type PermissionPickerProps = {
  permissions: PermissionOption[];
  selected: string[];
  onChange: (keys: string[]) => void;
  className?: string;
  maxHeight?: string;
};

export function PermissionPicker({
  permissions,
  selected,
  onChange,
  className,
  maxHeight = "min(320px, 50vh)",
}: PermissionPickerProps) {
  const [search, setSearch] = useState("");

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? permissions.filter(
          (p) =>
            p.key.toLowerCase().includes(q) ||
            p.label.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q),
        )
      : permissions;

    const byCategory = new Map<string, PermissionOption[]>();
    for (const p of filtered) {
      const list = byCategory.get(p.category) ?? [];
      list.push(p);
      byCategory.set(p.category, list);
    }
    return Array.from(byCategory.entries()).toSorted(([a], [b]) => a.localeCompare(b));
  }, [permissions, search]);

  function toggle(key: string) {
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  }

  function setCategory(keys: string[], on: boolean) {
    const set = new Set(selected);
    for (const k of keys) {
      if (on) set.add(k);
      else set.delete(k);
    }
    onChange([...set]);
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search permissions…"
          className="pl-8"
        />
      </div>

      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          <span className="font-medium text-foreground">{selected.length}</span> selected
        </span>
        {selected.length > 0 ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
            Clear all
          </Button>
        ) : null}
      </div>

      <ScrollArea style={{ height: maxHeight }} className="rounded-lg border border-border pr-3">
        <div className="space-y-4 p-3">
          {grouped.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No permissions match your search.</p>
          ) : (
            grouped.map(([category, items]) => {
              const keys = items.map((i) => i.key);
              const allOn = keys.every((k) => selected.includes(k));
              const someOn = keys.some((k) => selected.includes(k));
              return (
                <section key={category} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {category}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{items.length}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setCategory(keys, !allOn)}
                    >
                      {allOn ? "Deselect" : someOn ? "Select all" : "Select all"}
                    </Button>
                  </div>
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {items.map((p) => {
                      const checked = selected.includes(p.key);
                      return (
                        <li key={p.key}>
                          <label
                            className={cn(
                              "flex cursor-pointer items-start gap-2.5 rounded-md border px-2.5 py-2 text-sm transition-colors",
                              checked ? "border-primary/40 bg-primary/5" : "border-transparent hover:bg-muted/60",
                            )}
                          >
                            <Checkbox checked={checked} onCheckedChange={() => toggle(p.key)} className="mt-0.5" />
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium leading-snug">{p.label}</span>
                              <span className="font-mono text-xs text-muted-foreground">{p.key}</span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
