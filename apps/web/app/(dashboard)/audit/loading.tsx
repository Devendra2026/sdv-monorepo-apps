import { CardsSkeleton } from "@/components/shared/loading";
import { Skeleton } from "@workspace/ui/components/skeleton";

export default function AuditLoading() {
  return (
    <div className="space-y-6 lg:space-y-8" aria-busy="true" aria-label="Loading audit log">
      <div className="space-y-3">
        <Skeleton className="h-4 w-28 rounded-lg" />
        <Skeleton className="h-10 w-full max-w-md rounded-xl" />
      </div>
      <CardsSkeleton count={3} />
      <Skeleton className="h-120 w-full rounded-xl" />
    </div>
  );
}
