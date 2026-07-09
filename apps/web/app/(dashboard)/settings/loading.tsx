import { Skeleton } from "@workspace/ui/components/skeleton";

export default function SettingsLoading() {
  return (
    <div className="space-y-6 lg:space-y-8" aria-busy="true" aria-label="Loading settings">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-52 w-full rounded-2xl" />
        <Skeleton className="h-52 w-full rounded-2xl" />
      </div>
    </div>
  );
}
