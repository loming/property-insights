"use client";

import { createContext, use, useCallback, useMemo, useOptimistic, useState } from "react";

import { useUrlState } from "@/hooks/use-url-state";
import { cn } from "@/lib/utils";

import { FILTER_PARAMS, filterSearchParams, type MarketFilters } from "./filters";

type FilterContextValue = {
  /** The filters the page shows, or the ones it's loading. */
  filters: MarketFilters;
  setFilters: (next: MarketFilters) => void;
  isPending: boolean;
};

const FilterContext = createContext<FilterContextValue | null>(null);

export function useMarketFilters(): FilterContextValue {
  const value = use(FilterContext);
  if (!value) {
    throw new Error("useMarketFilters needs a MarketFiltersProvider");
  }
  return value;
}

/**
 * The page's filters, parsed from the URL on the server. Changing them rewrites the URL, so the server
 * renders the page again with the new filters (M-2); until it has, the controls already show the new
 * values (useOptimistic) and the results are dimmed.
 */
export function MarketFiltersProvider({ filters, children }: { filters: MarketFilters; children: React.ReactNode }) {
  const { searchParams, isPending, replace } = useUrlState();
  const [optimistic, setOptimistic] = useOptimistic(filters);

  const setFilters = useCallback(
    (next: MarketFilters) => {
      // Other parameters, such as the chart's segment or the table's sort, are kept.
      const params = new URLSearchParams(searchParams);
      for (const name of FILTER_PARAMS) {
        params.delete(name);
      }
      for (const [name, value] of filterSearchParams(next)) {
        params.append(name, value);
      }
      replace(params, () => setOptimistic(next));
    },
    [replace, searchParams, setOptimistic],
  );

  const value = useMemo(() => ({ filters: optimistic, setFilters, isPending }), [optimistic, setFilters, isPending]);
  return <FilterContext value={value}>{children}</FilterContext>;
}

/**
 * The results that the filters drive: dimmed, with a progress bar, while new ones load, and a status
 * message for screen readers when they arrive.
 */
export function FilterResults({ label, children }: { label: string; children: React.ReactNode }) {
  const { isPending } = useMarketFilters();
  const [message, setMessage] = useState("");
  // Updated while rendering, React's pattern for state that follows a changing value.
  const [wasPending, setWasPending] = useState(isPending);
  if (wasPending !== isPending) {
    setWasPending(isPending);
    if (!isPending) {
      setMessage(`${label} updated.`);
    }
  }

  return (
    <div aria-busy={isPending} className="relative">
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 -top-3 h-0.5 overflow-hidden rounded-full bg-transparent transition-opacity",
          isPending ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="h-full w-1/3 animate-[progress_1.1s_ease-in-out_infinite] rounded-full bg-primary motion-reduce:w-full motion-reduce:animate-none" />
      </div>
      <p role="status" className="sr-only">
        {isPending ? `Updating the ${label.toLowerCase()}…` : message}
      </p>
      <div className={cn("transition-opacity duration-200", isPending && "opacity-60")}>{children}</div>
    </div>
  );
}
