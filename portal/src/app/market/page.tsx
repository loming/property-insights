import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { WidgetBoundary } from "@/components/widget-boundary";
import {
  ChartSkeleton,
  DistributionWidget,
  KpiSkeleton,
  KpiWidget,
  ScatterWidget,
  SegmentWidget,
} from "@/features/market/dashboard-widgets";
import { FilterBar } from "@/features/market/filter-bar";
import { FilterResults, MarketFiltersProvider } from "@/features/market/filter-context";
import { filterSearchParams, parseFilters } from "@/features/market/filters";
import { parseSegmentBy } from "@/features/market/segments";
import { getFilterOptions } from "@/lib/api/market";

export const metadata: Metadata = { title: "Market dashboard" };

/**
 * M-1 and M-2. The filters come from the URL and apply on the server; each widget then fetches its own
 * data and streams in when ready. If market-api is down, market/error.tsx takes over this app only.
 */
export default async function MarketDashboardPage({ searchParams }: PageProps<"/market">) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const query = filterSearchParams(filters);
  const options = await getFilterOptions();

  return (
    <MarketFiltersProvider filters={filters}>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold">Market dashboard</h1>
          <p className="max-w-prose text-muted-foreground">
            The homes the model learned from, split by segment. Filter them below: the address keeps the filters,
            so a link shares this view.
          </p>
        </div>
        <FilterBar options={options} />
        <FilterResults label="Dashboard">
          <div className="space-y-6">
            <WidgetBoundary title="The headline figures">
              <Suspense fallback={<KpiSkeleton />}>
                <KpiWidget query={query} />
              </Suspense>
            </WidgetBoundary>
            <div className="grid gap-6 lg:grid-cols-2">
              <WidgetBoundary title="The price by segment chart">
                <Suspense fallback={<ChartSkeleton />}>
                  <SegmentWidget query={query} initial={parseSegmentBy(params.segment)} />
                </Suspense>
              </WidgetBoundary>
              <WidgetBoundary title="The price distribution chart">
                <Suspense fallback={<ChartSkeleton />}>
                  <DistributionWidget query={query} />
                </Suspense>
              </WidgetBoundary>
              <div className="lg:col-span-2">
                <WidgetBoundary title="The price against living area chart">
                  <Suspense fallback={<ChartSkeleton height={400} />}>
                    <ScatterWidget query={query} bedroomChoices={options.bedrooms} />
                  </Suspense>
                </WidgetBoundary>
              </div>
            </div>
            <Link
              href={query.size > 0 ? `/market/data?${query}` : "/market/data"}
              className="inline-flex min-h-6 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              See these homes in the table, and export them
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </FilterResults>
      </div>
    </MarketFiltersProvider>
  );
}
