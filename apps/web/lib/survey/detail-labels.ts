import type { MasterOption } from "@workspace/convex/lib/masters/areaMasters"

export function labelFromOptions(options: MasterOption[] | undefined, value: string | undefined): string {
  if (!value) return "—"
  const hit = options?.find((o) => o.value === value)
  return hit?.label ?? value.replace(/_/g, " ")
}
