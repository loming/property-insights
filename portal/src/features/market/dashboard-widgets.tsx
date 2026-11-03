import { Skeleton } from "@/components/ui/skeleton";
import { getDistribution, getMarketSummary, getProperties, getSegments, type SegmentBy } from "@/lib/api/market";

import { MarketKpis } from "./market-kpis";
import { PriceHistogram } from "./price-histogram";
import { PriceSizeScatter } from "./price-size-scatter";
import { SegmentPriceChart } from "./segment-price-chart";
import { SEGMENTATIONS } from "./segments";

/**
 * The dashboard's widgets: Server Components that each fetch their own data, so the page streams them
 * in as they're ready, each inside its own Suspense and error boundary (TR-1c, TR-2c).
 */

export async function KpiWidget({ query }: { query: URLSearchParams }) {
  const filtered = query.size > 0;
  // The whole market's count gives "12 of 50"; both responses are cached.
  const [summary, all] = await Promise.all([getMarketSummary(query), filtered ? getMarketSummary() : null]);
  return <MarketKpis summary={summary} total={all?.count} clearHref="/market" />;
}

export async function SegmentWidget({ query, initial }: { query: URLSearchParams; initial: SegmentBy }) {
  const splits = await Promise.all(SEGMENTATIONS.map((s) => getSegments(s.by, query)));
  return <SegmentPriceChart splits={splits} initial={initial} />;
}

export async function DistributionWidget({ query }: { query: URLSearchParams }) {
  const histograms = await Promise.all([getDistribution("price", query), getDistribution("price_per_sqft", query)]);
  return <PriceHistogram histograms={histograms} />;
}

export async function ScatterWidget({ query, bedroomChoices }: { query: URLSearchParams; bedroomChoices: number[] }) {
  const page = await getProperties(query);
  return <PriceSizeScatter homes={page.items} bedroomChoices={bedroomChoices} />;
}

export function KpiSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-44" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton({ height = 340 }: { height?: number }) {
  return <Skeleton className="w-full rounded-xl" style={{ height }} />;
}
