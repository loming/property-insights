/**
 * The market filters (M-2). The page URL and market-api's query string use the same snake_case names,
 * so a dashboard link is the API query: shareable, and applied on the server. Values are checked here as
 * well as in market-api: a hand-edited URL drops what it can't use instead of failing the page.
 * Safe to import on the client.
 */
import { formatNumber, formatPrice } from "@/lib/format";

export type SearchParamsInput = URLSearchParams | Record<string, string | string[] | undefined>;

export const RANGE_FILTERS = [
  { name: "price", label: "Price", minParam: "min_price", maxParam: "max_price", bounds: "price", step: 5_000 },
  { name: "sqft", label: "Living area", unit: "sq ft", minParam: "min_sqft", maxParam: "max_sqft", bounds: "square_footage", step: 10 },
  { name: "bathrooms", label: "Bathrooms", minParam: "min_bathrooms", maxParam: "max_bathrooms", bounds: "bathrooms", step: 0.5 },
  { name: "year", label: "Year built", minParam: "min_year", maxParam: "max_year", bounds: "year_built", step: 1 },
  { name: "school", label: "School rating", unit: "out of 10", minParam: "min_school_rating", maxParam: "max_school_rating", bounds: "school_rating", step: 0.1 },
  { name: "distance", label: "Distance to city centre", unit: "miles", minParam: "min_distance", maxParam: "max_distance", bounds: "distance_to_city_center", step: 0.1 },
] as const;

export type RangeFilter = (typeof RANGE_FILTERS)[number];
export type RangeParam = RangeFilter["minParam"] | RangeFilter["maxParam"];

export type MarketFilters = { bedrooms: number[] } & Partial<Record<RangeParam, number>>;

/** Every query parameter that is a filter: the market's tabs carry these from page to page. */
export const FILTER_PARAMS: readonly string[] = ["bedrooms", ...RANGE_FILTERS.flatMap((r) => [r.minParam, r.maxParam])];

const MAX_BEDROOM_CHOICES = 10;

function values(input: SearchParamsInput, key: string): string[] {
  if (input instanceof URLSearchParams) {
    return input.getAll(key);
  }
  const value = input[key];
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function parseBound(raw: string | undefined, range: RangeFilter): number | undefined {
  if (raw === undefined || raw.trim() === "") {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return undefined;
  }
  // The same limits as market-api's MarketFilter.
  if (range.name === "year" && (!Number.isInteger(value) || value < 1800 || value > 2100)) {
    return undefined;
  }
  if (range.name === "school" && value > 10) {
    return undefined;
  }
  return value;
}

export function parseFilters(input: SearchParamsInput): MarketFilters {
  const bedrooms = values(input, "bedrooms")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => /^\d{1,2}$/.test(value))
    .map(Number)
    .filter((value) => value <= 20);
  const filters: MarketFilters = {
    bedrooms: [...new Set(bedrooms)].sort((a, b) => a - b).slice(0, MAX_BEDROOM_CHOICES),
  };
  for (const range of RANGE_FILTERS) {
    const min = parseBound(values(input, range.minParam)[0], range);
    const max = parseBound(values(input, range.maxParam)[0], range);
    // An inverted range can only come from editing the URL by hand: ignore it rather than fail the page.
    if (min !== undefined && max !== undefined && min > max) {
      continue;
    }
    if (min !== undefined) {
      filters[range.minParam] = min;
    }
    if (max !== undefined) {
      filters[range.maxParam] = max;
    }
  }
  return filters;
}

/** The filters as a query string, in a fixed order: the page URL and market-api take the same one. */
export function filterSearchParams(filters: MarketFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const bedrooms of filters.bedrooms) {
    params.append("bedrooms", String(bedrooms));
  }
  for (const range of RANGE_FILTERS) {
    for (const param of [range.minParam, range.maxParam]) {
      const value = filters[param];
      if (value !== undefined) {
        params.set(param, String(value));
      }
    }
  }
  return params;
}

export function hasFilters(filters: MarketFilters): boolean {
  return filterSearchParams(filters).size > 0;
}

function joinWords(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}

function formatBound(range: RangeFilter, value: number): string {
  if (range.name === "price") {
    return formatPrice(value);
  }
  if (range.name === "year") {
    return String(value);
  }
  return formatNumber(value);
}

/** Each active filter in words, e.g. ["2 or 3 bedrooms", "Price $200,000 to $300,000"]. */
export function describeFilters(filters: MarketFilters): string[] {
  const parts: string[] = [];
  if (filters.bedrooms.length > 0) {
    parts.push(`${joinWords(filters.bedrooms.map(String))} bedrooms`);
  }
  for (const range of RANGE_FILTERS) {
    const min = filters[range.minParam];
    const max = filters[range.maxParam];
    if (min === undefined && max === undefined) {
      continue;
    }
    const unit = "unit" in range ? ` ${range.unit}` : "";
    const span =
      min !== undefined && max !== undefined
        ? min === max
          ? formatBound(range, min)
          : `${formatBound(range, min)} to ${formatBound(range, max)}`
        : min !== undefined
          ? `at least ${formatBound(range, min)}`
          : `up to ${formatBound(range, max!)}`;
    parts.push(`${range.label} ${span}${unit}`);
  }
  return parts;
}

export type Bounds = { min: number; max: number };

/** A value rounded to its step's decimals: 0.1 steps make 7.5, never 7.499999999999999. */
export function roundToStep(value: number, step: number): number {
  const decimals = String(step).split(".")[1]?.length ?? 0;
  return Number(value.toFixed(decimals));
}

/** A slider's ends: the data's range for that filter, widened to whole steps so every home is in reach. */
export function sliderBounds(range: RangeFilter, data: Bounds): Bounds {
  const steps = (value: number) => roundToStep(value / range.step, 0.000001);
  return {
    min: roundToStep(Math.floor(steps(data.min)) * range.step, range.step),
    max: roundToStep(Math.ceil(steps(data.max)) * range.step, range.step),
  };
}

/** The table's sort fields, as market-api's /properties and exports accept them. */
export const SORT_FIELDS = [
  "id",
  "price",
  "price_per_sqft",
  "square_footage",
  "bedrooms",
  "bathrooms",
  "year_built",
  "lot_size",
  "distance_to_city_center",
  "school_rating",
] as const;

export type SortField = (typeof SORT_FIELDS)[number];
export type Sort = { field: SortField; direction: "asc" | "desc" };

export const DEFAULT_SORT: Sort = { field: "id", direction: "asc" };

export function parseSort(raw: string | string[] | undefined): Sort {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const [field, direction] = (value ?? "").split(",");
  if ((SORT_FIELDS as readonly string[]).includes(field ?? "") && (direction === "asc" || direction === "desc")) {
    return { field: field as SortField, direction };
  }
  return DEFAULT_SORT;
}

export function formatSort(sort: Sort): string {
  return `${sort.field},${sort.direction}`;
}
