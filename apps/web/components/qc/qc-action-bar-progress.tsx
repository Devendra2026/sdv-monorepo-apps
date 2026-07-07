import { cn } from "@/lib/utils";

export function QcActionBarProgress({
  isApproved,
  correctionsSaved,
  mode = "review",
}: {
  isApproved: boolean;
  correctionsSaved: boolean;
  mode?: "review" | "edit";
}) {
  const width = isApproved
    ? "w-full"
    : mode === "edit" && correctionsSaved
      ? "w-3/4"
      : mode === "edit"
        ? "w-1/2"
        : "w-1/3";

  const gradient = isApproved
    ? "bg-linear-to-r from-emerald-600 to-emerald-500"
    : mode === "edit" && correctionsSaved
      ? "bg-linear-to-r from-amber-500 to-emerald-500"
      : "bg-linear-to-r from-amber-500 to-amber-400";

  return (
    <div className="h-1 w-full bg-muted">
      <div className={cn("h-full transition-all duration-500", width, gradient)} />
    </div>
  );
}
