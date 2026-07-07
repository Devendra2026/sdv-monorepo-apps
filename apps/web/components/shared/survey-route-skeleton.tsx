import { CardsSkeleton, TableSkeleton } from "@/components/shared/loading"

export function SurveyPageSkeleton({
  variant = "command",
}: {
  variant?: "command" | "registry" | "detail" | "edit" | "ward"
}) {
  if (variant === "detail" || variant === "edit") {
    return (
      <div className="space-y-6">
        <div className="h-9 w-36 animate-pulse rounded-xl bg-muted/80" />
        <div className="h-40 w-full animate-pulse rounded-2xl bg-muted/70 shadow-premium-sm" />
        <div className="grid gap-5">
          <div className="h-48 w-full animate-pulse rounded-2xl bg-muted/60" />
          <div className="h-48 w-full animate-pulse rounded-2xl bg-muted/60" />
          <div className="h-64 w-full animate-pulse rounded-2xl bg-muted/60" />
        </div>
      </div>
    )
  }

  if (variant === "ward") {
    return (
      <div className="space-y-6">
        <div className="h-9 w-40 animate-pulse rounded-xl bg-muted/80" />
        <div className="h-28 w-full animate-pulse rounded-2xl bg-muted/70" />
        <CardsSkeleton count={4} />
        <TableSkeleton rows={8} />
      </div>
    )
  }

  if (variant === "registry") {
    return (
      <div className="space-y-6">
        <div className="h-24 w-full animate-pulse rounded-2xl bg-muted/70" />
        <div className="h-12 w-full max-w-xl animate-pulse rounded-xl bg-muted/60" />
        <TableSkeleton rows={10} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="h-24 w-full animate-pulse rounded-2xl bg-linear-to-r from-indigo-500/10 via-muted/60 to-emerald-500/10" />
      <div className="h-32 w-full animate-pulse rounded-xl bg-muted/60" />
      <CardsSkeleton count={4} />
      <CardsSkeleton count={6} />
    </div>
  )
}
