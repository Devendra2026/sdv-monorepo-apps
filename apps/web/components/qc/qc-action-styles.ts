import { cn } from "@/lib/utils";

/** Shared QC action button tokens — review bar + edit save bar. */
export const qcActionBtn = {
  base: "min-h-11 cursor-pointer rounded-xl px-5 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 disabled:pointer-events-none disabled:opacity-50",
  approve: cn(
    "bg-emerald-600 text-white shadow-md hover:bg-emerald-500",
    "dark:bg-emerald-600 dark:hover:bg-emerald-500",
  ),
  reopen: cn(
    "border border-amber-400/60 bg-background text-amber-950 hover:bg-amber-500/10",
    "dark:border-amber-600/50 dark:text-amber-100 dark:hover:bg-amber-900/30",
  ),
  edit: cn(
    "border border-amber-400/60 bg-background text-amber-950 hover:bg-amber-500/10",
    "dark:border-amber-600/50 dark:text-amber-100 dark:hover:bg-amber-900/30",
  ),
  delete: cn("border border-transparent text-brand-red hover:bg-brand-red/10", "dark:hover:bg-brand-red/15"),
  save: cn("bg-amber-600 text-white shadow-md hover:bg-amber-500", "dark:bg-amber-600 dark:hover:bg-amber-500"),
  nextQc: cn("bg-brand-navy text-white shadow-md hover:bg-brand-navy/90", "dark:bg-primary dark:hover:bg-primary/90"),
  secondary: cn("border border-border/70 bg-card/80 hover:bg-muted/40"),
} as const;
