import { CardsSkeleton, TableSkeleton } from "@/components/shared/loading"
import { Skeleton } from "@workspace/ui/components/skeleton"

export function QcPageSkeleton({
  variant = "review",
}: {
  variant?: "command" | "review" | "registry" | "edit" | "report" | "demand-notice" | "ward"
}) {
  if (variant === "command") {
    return (
      <div className="space-y-6 lg:space-y-8" aria-busy="true" aria-label="Loading QC command center">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <CardsSkeleton count={4} />
        <CardsSkeleton count={3} />
      </div>
    )
  }

  if (variant === "registry") {
    return (
      <div className="space-y-6 lg:space-y-8" aria-busy="true" aria-label="Loading QC registry">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full max-w-md rounded-xl" />
        <CardsSkeleton count={4} />
        <TableSkeleton rows={8} />
      </div>
    )
  }

  if (variant === "report" || variant === "demand-notice") {
    return (
      <div className="space-y-6" aria-busy="true" aria-label={`Loading QC ${variant}`}>
        <Skeleton className="h-9 w-40 rounded-xl" />
        <Skeleton className="h-[700px] w-full rounded-2xl" />
      </div>
    )
  }

  if (variant === "ward") {
    return (
      <div className="space-y-6 lg:space-y-8" aria-busy="true" aria-label="Loading ward report">
        <Skeleton className="h-9 w-48 rounded-xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <CardsSkeleton count={3} />
        <TableSkeleton rows={8} />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-28" aria-busy="true" aria-label="Loading QC review">
      <Skeleton className="h-9 w-36 rounded-xl" />
      <Skeleton className="h-36 w-full rounded-2xl" />
      <Skeleton className="h-96 w-full rounded-xl" />
      {variant === "edit" ? <Skeleton className="h-64 w-full rounded-xl" /> : null}
    </div>
  )
}
