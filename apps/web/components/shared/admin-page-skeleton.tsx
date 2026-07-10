import { CardsSkeleton } from "@/components/shared/loading"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { cn } from "@workspace/ui/lib/utils"

export type AdminPageSkeletonVariant = "registry" | "master-detail" | "tabs"

function HeroSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/80 p-6 shadow-premium-lg sm:p-8">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-3 w-32 rounded-md" />
        </div>
        <Skeleton className="h-8 w-full max-w-md rounded-xl sm:h-9" />
        <Skeleton className="h-4 w-full max-w-2xl rounded-lg" />
        <Skeleton className="h-4 max-w-xl rounded-lg" />
        <div className="flex flex-wrap gap-2 pt-2">
          <Skeleton className="h-10 w-36 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

function RegistryTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/80">
      <div className="border-b border-border/60 px-5 py-4">
        <Skeleton className="h-4 w-40 rounded-md" />
        <Skeleton className="mt-2 h-3 w-64 rounded-md" />
      </div>
      <div className="space-y-2 p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}

function MasterDetailSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/80" style={{ minHeight: 600 }}>
      <div className="grid min-h-[600px] lg:grid-cols-[280px_1fr]">
        <div className="space-y-2 border-b border-border/60 p-4 lg:border-r lg:border-b-0">
          <Skeleton className="mb-3 h-9 w-full rounded-xl" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-xl" />
          ))}
        </div>
        <div className="space-y-4 p-5">
          <Skeleton className="h-7 w-48 rounded-lg" />
          <Skeleton className="h-4 w-full max-w-lg rounded-md" />
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}

function TabsSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/80">
      <div className="flex gap-2 border-b border-border/60 px-4 py-3">
        <Skeleton className="h-9 w-28 rounded-xl" />
        <Skeleton className="h-9 w-24 rounded-xl" />
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>
      <div className="space-y-2 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}

export function AdminPageSkeleton({
  variant = "registry",
  metricCount = 4,
  label = "Loading administration page",
  className,
}: {
  variant?: AdminPageSkeletonVariant
  metricCount?: number
  label?: string
  className?: string
}) {
  return (
    <div className={cn("space-y-6 lg:space-y-8", className)} aria-busy="true" aria-label={label}>
      <HeroSkeleton />
      <CardsSkeleton count={metricCount} />
      {variant === "master-detail" ? <MasterDetailSkeleton /> : null}
      {variant === "registry" ? <RegistryTableSkeleton /> : null}
      {variant === "tabs" ? <TabsSkeleton /> : null}
    </div>
  )
}
