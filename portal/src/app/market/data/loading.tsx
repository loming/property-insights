import { Skeleton } from "@/components/ui/skeleton";

export default function MarketDataLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading the market data</span>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-44 w-full rounded-xl" />
      <div className="space-y-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    </div>
  );
}
