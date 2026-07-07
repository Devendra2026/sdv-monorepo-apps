/** Compact inline notice for section-level gates (tabs, cards, toolbars). */
export function PermissionDeniedInline({
  description = "You don't have permission to view this content.",
}: {
  description?: string;
}) {
  return (
    <p className="rounded-lg border border-dashed border-border/60 bg-muted/30 px-4 py-5 text-center text-sm text-muted-foreground">
      {description}
    </p>
  );
}
