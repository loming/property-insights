import type { Metadata } from "next";

import { FilterBar } from "@/features/market/filter-bar";
import { FilterResults, MarketFiltersProvider } from "@/features/market/filter-context";
import { filterSearchParams, parseFilters, parseSort } from "@/features/market/filters";
import { PropertyTable } from "@/features/market/property-table";
import { getFilterOptions, getProperties } from "@/lib/api/market";

export const metadata: Metadata = { title: "Market data" };

/**
 * M-4 and M-5. The homes matching the URL's filters come from market-api in one page (it holds 50; a
 * page holds up to 100); the table sorts, searches and pages them in the browser.
 */
export default async function MarketDataPage({ searchParams }: PageProps<"/market/data">) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const query = filterSearchParams(filters);
  const [options, homes] = await Promise.all([getFilterOptions(), getProperties(query)]);

  return (
    <MarketFiltersProvider filters={filters}>
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold">Market data</h1>
          <p className="max-w-prose text-muted-foreground">
            Every home that matches the filters. Sort by any column, search the values, and export the list as a
            spreadsheet or a PDF report.
          </p>
        </div>
        <FilterBar options={options} />
        <FilterResults label="Table">
          <PropertyTable rows={homes.items} initialSort={parseSort(params.sort)} filterQuery={query.toString()} />
          {homes.total > homes.items.length && (
            <p className="mt-3 text-sm text-muted-foreground">
              The table shows the first {homes.items.length} of {homes.total} homes; the exports include them all.
            </p>
          )}
        </FilterResults>
      </div>
    </MarketFiltersProvider>
  );
}
