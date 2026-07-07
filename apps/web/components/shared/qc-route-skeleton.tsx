import { CardsSkeleton, TableSkeleton } from "@/components/shared/loading";
import { Skeleton } from "@/components/ui/skeleton";

export function QcPageSkeleton({ variant = "review" }: { variant?: "review" | "registry" | "edit" }) {
  if (variant === "registry") {
    return (
      <div className="space-y-6 lg:space-y-8" aria-busy="true" aria-label="Loading QC registry">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full max-w-md rounded-xl" />
        <CardsSkeleton count={4} />
        <TableSkeleton rows={8} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-28" aria-busy="true" aria-label="Loading QC review">
      <Skeleton className="h-9 w-36 rounded-xl" />
      <Skeleton className="h-36 w-full rounded-2xl" />
      <Skeleton className="h-96 w-full rounded-xl" />
      {variant === "edit" ? <Skeleton className="h-64 w-full rounded-xl" /> : null}
    </div>
  );
}
