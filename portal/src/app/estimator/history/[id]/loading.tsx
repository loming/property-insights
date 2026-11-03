import { Skeleton } from "@/components/ui/skeleton";

export default function SavedEstimateLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">Loading the estimate</span>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-12 w-48" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
