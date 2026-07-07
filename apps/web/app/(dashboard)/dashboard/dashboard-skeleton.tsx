import { Skeleton } from "@workspace/ui/components/skeleton"

function KpiCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-7 w-16 rounded-lg" />
          <Skeleton className="h-3 w-24 rounded" />
        </div>
        <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
      </div>
    </div>
  )
}

export function DashboardHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-3 w-36 rounded" />
        <Skeleton className="h-7 w-64 max-w-full rounded-lg" />
        <Skeleton className="h-4 w-full max-w-xl rounded" />
        <Skeleton className="h-3 w-48 rounded" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
    </div>
  )
}

export function DashboardKpisSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading KPI metrics">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-32 rounded" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function DashboardQcOperationsSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading QC operations">
      <Skeleton className="h-4 w-32 rounded" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

function ChartCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card shadow-sm ${className ?? ""}`}>
      <div className="border-b border-border px-4 py-3">
        <Skeleton className="h-4 w-40 rounded" />
        <Skeleton className="mt-1.5 h-3 w-56 rounded" />
      </div>
      <div className="p-4">
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    </div>
  )
}

export function DashboardAnalyticsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading analytics">
      <div className="space-y-3">
        <Skeleton className="h-4 w-40 rounded" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-44 rounded" />
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCardSkeleton className="lg:col-span-2" />
          <ChartCardSkeleton />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-28 rounded" />
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
    </div>
  )
}

export function DashboardActivitySkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm" aria-busy="true" aria-label="Loading activity">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-32 rounded" />
        </div>
        <Skeleton className="mt-1.5 h-3 w-48 rounded" />
      </div>
      <DashboardActivityContentSkeleton />
    </div>
  )
}

export function DashboardActivityContentSkeleton() {
  return (
    <div className="space-y-3 p-4" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4 rounded" />
            <Skeleton className="h-3 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function DashboardHomeSkeleton() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <DashboardKpisSkeleton />
      <DashboardAnalyticsSkeleton />
    </div>
  )
}

export function DashboardSectionsSkeleton() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <DashboardHomeSkeleton />
      <DashboardActivitySkeleton />
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 lg:space-y-8">
      <DashboardHeaderSkeleton />
      <DashboardHomeSkeleton />
      <DashboardActivitySkeleton />
    </div>
  )
}
