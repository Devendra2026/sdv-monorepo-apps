import { TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function PropertyIdTableCell({ propertyId, className }: { propertyId?: string; className?: string }) {
  return (
    <TableCell className={cn("font-mono text-xs whitespace-nowrap", className)}>{propertyId?.trim() || "—"}</TableCell>
  );
}
