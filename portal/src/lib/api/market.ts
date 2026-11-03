import "server-only";

import { apiFetch, apiResponse } from "./client";

/** App 2's backend (market-api). App 1's code must not import this (see eslint.config.mjs). */

export type MarketHealth = { status: "UP" | "DOWN" | "OUT_OF_SERVICE" | "UNKNOWN" };

export type MarketSummary = {
  count: number;
  price: { mean: number; median: number; min: number; max: number; q1: number; q3: number } | null;
  mean_price_per_sqft: number | null;
  mean_square_footage: number | null;
  mean_school_rating: number | null;
};

export type SegmentBy = "bedrooms" | "bathrooms" | "decade" | "school_band" | "distance_band";

export type SegmentRow = {
  segment: string;
  count: number;
  mean_price: number;
  median_price: number;
  mean_price_per_sqft: number;
};

export type Segments = { by: SegmentBy; segments: SegmentRow[] };

export type HomeFeatures = {
  square_footage: number;
  bedrooms: number;
  bathrooms: number;
  year_built: number;
  lot_size: number;
  distance_to_city_center: number;
  school_rating: number;
};

/** A segment's median home, rounded to values the model accepts: the what-if baselines. */
export type SegmentMedian = { segment: string; count: number; median_price: number; features: HomeFeatures };

export type SegmentMedians = { by: SegmentBy; segments: SegmentMedian[] };

export type DistributionMetric = "price" | "price_per_sqft";

export type Histogram = {
  metric: DistributionMetric;
  count: number;
  bins: { lower: number; upper: number; count: number }[];
};

export type PropertyRow = HomeFeatures & { id: number; price: number; price_per_sqft: number };

export type PropertyPage = { items: PropertyRow[]; total: number; page: number; size: number; sort: string };

export type FilterOptions = {
  ranges: Record<string, { min: number; max: number }>;
  bedrooms: number[];
  bathrooms: number[];
  segment_by: SegmentBy[];
  sort_fields: string[];
};

export type ModelWarning = { code: string; field: string | null; value: number | null; message: string };

/** The parts of ml-api's /model-info that App 2 shows, through market-api's cached pass-through. */
export type MarketModelInfo = {
  model_type: "linear_regression" | "ridge";
  model_version: string;
  training_rows: number;
  coefficients: { feature: string; per_unit: number; unit: string }[];
  features: {
    name: string;
    label: string;
    unit: string;
    training_min: number;
    training_max: number;
    allowed_min: number;
    allowed_max: number;
    step?: number | null;
  }[];
  notes: string[];
};

export type WhatIfRequest = { baseline: HomeFeatures; changes: Partial<HomeFeatures> };

export type WhatIfResult = {
  baseline: HomeFeatures;
  scenario: HomeFeatures;
  baseline_price: number;
  scenario_price: number;
  delta: number;
  delta_pct: number;
  baseline_warnings: ModelWarning[];
  scenario_warnings: ModelWarning[];
  model_version: string;
};

export type SensitivityRequest = {
  baseline: HomeFeatures;
  feature: keyof HomeFeatures;
  from: number;
  to: number;
  steps: number;
};

export type SensitivityResult = {
  feature: keyof HomeFeatures;
  points: { value: number; predicted_price: number; warnings: ModelWarning[] }[];
  model_version: string;
};

/** The dataset is fixed, so aggregates are reused for 5 minutes (market-api caches them too). */
const AGGREGATES = { revalidate: 300, tags: ["market"] };

function withQuery(path: string, query: URLSearchParams): string {
  return query.size > 0 ? `${path}?${query}` : path;
}

export function getMarketHealth(): Promise<MarketHealth> {
  return apiFetch<MarketHealth>("market", "/actuator/health", { timeoutMs: 3_000 });
}

export function getMarketSummary(filters = new URLSearchParams()): Promise<MarketSummary> {
  return apiFetch<MarketSummary>("market", withQuery("/api/v1/market/summary", filters), AGGREGATES);
}

export function getSegments(by: SegmentBy, filters = new URLSearchParams()): Promise<Segments> {
  const query = new URLSearchParams([["by", by], ...filters]);
  return apiFetch<Segments>("market", withQuery("/api/v1/market/segments", query), AGGREGATES);
}

export function getSegmentMedians(by: SegmentBy, filters = new URLSearchParams()): Promise<SegmentMedians> {
  const query = new URLSearchParams([["by", by], ...filters]);
  return apiFetch<SegmentMedians>("market", withQuery("/api/v1/market/segments/medians", query), AGGREGATES);
}

export function getDistribution(
  metric: DistributionMetric,
  filters = new URLSearchParams(),
  bins = 8,
): Promise<Histogram> {
  const query = new URLSearchParams([["metric", metric], ["bins", String(bins)], ...filters]);
  return apiFetch<Histogram>("market", withQuery("/api/v1/market/distribution", query), AGGREGATES);
}

/** One page of homes; market-api caps a page at 100, twice the dataset. */
export function getProperties(
  filters = new URLSearchParams(),
  { sort = "id,asc", page = 0, size = 100 }: { sort?: string; page?: number; size?: number } = {},
): Promise<PropertyPage> {
  const query = new URLSearchParams([...filters, ["sort", sort], ["page", String(page)], ["size", String(size)]]);
  return apiFetch<PropertyPage>("market", withQuery("/api/v1/market/properties", query), AGGREGATES);
}

export function getFilterOptions(): Promise<FilterOptions> {
  return apiFetch<FilterOptions>("market", "/api/v1/market/filter-options", AGGREGATES);
}

/** market-api keeps the model's details for 10 minutes, so App 2 never needs App 1's backend (P-0). */
export function getMarketModelInfo(): Promise<MarketModelInfo> {
  return apiFetch<MarketModelInfo>("market", "/api/v1/market/model-info", { revalidate: 600, tags: ["model-info"] });
}

// Predictions are cached by market-api (keyed by the model version), not here.

export function postWhatIf(body: WhatIfRequest): Promise<WhatIfResult> {
  return apiFetch<WhatIfResult>("market", "/api/v1/market/what-if", { method: "POST", body });
}

export function postSensitivity(body: SensitivityRequest): Promise<SensitivityResult> {
  return apiFetch<SensitivityResult>("market", "/api/v1/market/what-if/sensitivity", { method: "POST", body });
}

/** The CSV or PDF of the filtered homes, unread, for the export Route Handler to stream on. */
export function getExport(format: "csv" | "pdf", query: URLSearchParams): Promise<Response> {
  return apiResponse("market", withQuery(`/api/v1/market/export/${format}`, query), {
    accept: format === "csv" ? "text/csv" : "application/pdf",
    timeoutMs: 15_000,
  });
}
