import { Skeleton } from "@/components/ui/skeleton";

export default function WhatIfLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading the what-if analysis</span>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-9 w-full max-w-xl" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <Skeleton className="h-96 rounded-xl lg:order-last lg:h-64" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  );
}
