/** Survey / QC status visuals — SDV navy + red brand, AA-friendly contrast */
export const SURVEY_STATUS_BADGE: Record<string, string> = {
  draft: "border-border/70 bg-muted/60 text-muted-foreground",
  submitted:
    "border-brand-navy/35 bg-brand-navy/10 text-brand-navy dark:border-primary/40 dark:bg-primary/15 dark:text-primary-foreground",
  approved: "border-success/35 bg-success/12 text-emerald-800 dark:text-emerald-300",
  rejected: "border-brand-red/35 bg-brand-red/10 text-brand-red dark:text-brand-red-foreground",
};

export const QC_STATUS_BADGE: Record<string, string> = {
  pending:
    "border-warning/45 bg-warning/14 text-amber-950 dark:border-warning/40 dark:bg-warning/12 dark:text-amber-200",
  approved: "border-success/35 bg-success/12 text-emerald-800 dark:text-emerald-300",
  rejected: "border-brand-red/35 bg-brand-red/10 text-brand-red dark:text-brand-red-foreground",
};

export const SURVEY_ROW_TONE: Record<string, string> = {
  draft: "hover:bg-muted/35",
  submitted: "bg-brand-navy/4 hover:bg-brand-navy/8 dark:bg-primary/6 dark:hover:bg-primary/10",
  qcPending: "bg-warning/7 hover:bg-warning/12",
  approved: "bg-success/6 hover:bg-success/10",
  rejected: "bg-brand-red/5 hover:bg-brand-red/9",
};

/** Survey Command Center module — indigo workflow accent with emerald CTA. */
export const SURVEY_MODULE = {
  accent: "#6366F1",
  approved: "#10B981",
  structure: "#002366",
  canvas: "#F5F3FF",
  heroGradient: "brand" as const,
  tabActive: "data-[state=active]:bg-indigo-600 data-[state=active]:text-white",
  tableHeader:
    "border-indigo-500/15 bg-linear-to-r from-indigo-500/12 via-indigo-500/6 to-transparent dark:from-indigo-500/18",
  cardBorder: "border-indigo-500/15",
  scopeBanner: "border-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-950/15",
  metricTones: {
    total: "info",
    drafts: "default",
    submitted: "info",
    approved: "success",
  } as const,
} as const;

/** Survey registry / ward data tables — typography + surface tokens. */
export const SURVEY_TABLE = {
  wrapper:
    "premium-card overflow-hidden rounded-xl border border-indigo-500/20 bg-card/90 shadow-premium-sm backdrop-blur-sm",
  scroll: "overflow-x-auto",
  table: "min-w-[1100px] w-full",
  headerRow:
    "border-b border-indigo-500/20 bg-linear-to-r from-brand-navy/8 via-indigo-500/10 to-transparent hover:from-brand-navy/8 dark:from-brand-navy/20 dark:via-indigo-500/12",
  headerCell:
    "h-10 bg-inherit font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-navy/70 dark:text-indigo-100/80",
  bodyRow:
    "h-12 cursor-pointer border-b border-border/40 text-sm transition-colors duration-200 last:border-b-0 even:bg-muted/15 hover:bg-muted/25",
  monoCell: "font-mono text-xs font-medium tabular-nums text-foreground",
  bodyCell: "py-2.5",
  sectionLabel: "text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70",
} as const;

/** QC registry / ward data tables — typography + surface tokens. */
export const QC_TABLE = {
  wrapper:
    "premium-card overflow-hidden rounded-xl border border-amber-500/20 bg-card/90 shadow-premium-sm backdrop-blur-sm",
  scroll: "overflow-x-auto",
  table: "min-w-[1100px] w-full",
  headerRow:
    "border-b border-amber-500/20 bg-linear-to-r from-brand-navy/8 via-amber-500/10 to-transparent hover:from-brand-navy/8 dark:from-brand-navy/20 dark:via-amber-500/12",
  headerCell:
    "h-10 bg-inherit font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-navy/70 dark:text-amber-100/80",
  bodyRow:
    "h-12 cursor-pointer border-b border-border/40 text-sm transition-colors duration-200 last:border-b-0 even:bg-muted/15 hover:bg-muted/25",
  monoCell: "font-mono text-xs font-medium tabular-nums text-foreground",
  bodyCell: "py-2.5",
  sectionLabel: "text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70",
} as const;

/** Parcel duplicate indicators — shared parcel vs different-owner conflict. */
export const QC_DUPLICATE_BADGE = {
  duplicate:
    "border-brand-red/50 bg-brand-red/10 text-brand-red ring-1 ring-brand-red/25 dark:border-brand-red/40 dark:bg-brand-red/15 dark:text-brand-red-foreground",
  shared:
    "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/12 dark:text-amber-200",
  conflictPanel: "border-amber-500/30 bg-amber-500/8 dark:border-amber-500/25 dark:bg-amber-950/20",
  conflictAlert:
    "rounded-lg border border-amber-500/35 bg-amber-500/12 px-3 py-2 text-xs font-medium text-amber-950 dark:text-amber-100",
  rejectButton: "text-brand-red hover:bg-brand-red/10 dark:text-brand-red-foreground",
  currentRowHighlight: "bg-amber-500/12 ring-1 ring-inset ring-amber-500/25",
} as const;
