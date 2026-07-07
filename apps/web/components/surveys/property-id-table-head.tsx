import { TableHead } from "@workspace/ui/components/table";
import { cn } from "@workspace/ui/lib/utils";

/** Shared Property ID column header for survey-scoped tables. */
export function PropertyIdTableHead({ className }: { className?: string }) {
  return <TableHead className={cn("font-mono text-xs whitespace-nowrap", className)}>Property ID</TableHead>
}
