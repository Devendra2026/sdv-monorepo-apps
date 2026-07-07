import { TableCell } from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"

export function PropertyIdTableCell({ propertyId, className }: { propertyId?: string; className?: string }) {
  return (
    <TableCell className={cn("font-mono text-xs whitespace-nowrap", className)}>{propertyId?.trim() || "—"}</TableCell>
  )
}
