import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** Shared Property ID column header for survey-scoped tables. */
export function PropertyIdTableHead({ className }: { className?: string }) {
  return <TableHead className={cn("font-mono text-xs whitespace-nowrap", className)}>Property ID</TableHead>;
}
