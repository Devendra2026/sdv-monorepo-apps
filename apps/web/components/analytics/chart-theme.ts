/** Semantic chart colors — read from CSS variables (light/dark aware). */
export const chartPalette = {
  primary: "var(--chart-primary)",
  positive: "var(--chart-positive)",
  caution: "var(--chart-caution)",
  negative: "var(--chart-negative)",
  muted: "var(--chart-muted)",
} as const;

export function approvalBarClass(rate: number): string {
  if (rate >= 60) return "bg-emerald-500 dark:bg-emerald-400";
  if (rate >= 30) return "bg-amber-500 dark:bg-amber-400";
  return "bg-muted-foreground/40";
}

export const chartTooltipStyle = {
  contentStyle: {
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--popover)",
    color: "var(--popover-foreground)",
    fontSize: 12,
    boxShadow: "0 4px 12px oklch(0 0 0 / 8%)",
  },
  labelStyle: { color: "var(--muted-foreground)", fontWeight: 500 },
};
