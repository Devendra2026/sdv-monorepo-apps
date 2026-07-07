"use client";

import { TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export const ADMIN_TABS_LIST =
  "flex h-auto w-full flex-wrap justify-start gap-1.5 rounded-xl border border-border/60 bg-muted/30 p-1.5 backdrop-blur-sm";

export function AdminTabPill({
  value,
  label,
  count,
  icon,
  activeColor,
}: {
  value: string;
  label: string;
  count?: number | string;
  icon?: React.ReactNode;
  activeColor?: string;
}) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded-lg border border-transparent px-4 py-2 text-xs font-semibold text-muted-foreground transition-all duration-200 hover:border-border hover:text-foreground",
        activeColor ??
          "data-[state=active]:bg-brand-navy data-[state=active]:text-white dark:data-[state=active]:bg-primary",
      )}
    >
      {icon}
      {label}
      {count !== undefined && (
        <span className="min-w-5 rounded-full bg-black/10 px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums dark:bg-white/10">
          {count}
        </span>
      )}
    </TabsTrigger>
  );
}
