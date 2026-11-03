/** The market table's columns, sorting, search and paging (M-5), kept apart from the markup for testing. */
import type { PropertyRow } from "@/lib/api/market";
import { formatNumber, formatPrice } from "@/lib/format";

import type { Sort, SortField } from "./filters";

export type Column = {
  field: SortField;
  label: string;
  /**
   * The full name for screen readers where the header is shortened. It contains the visible label, so
   * speech control users can say what they see (WCAG 2.5.3).
   */
  description?: string;
  format: (row: PropertyRow) => string;
};

export const COLUMNS: readonly Column[] = [
  { field: "id", label: "Home", format: (r) => `#${r.id}` },
  { field: "price", label: "Price", format: (r) => formatPrice(r.price) },
  { field: "price_per_sqft", label: "Per sq ft", description: "Price per sq ft", format: (r) => formatPrice(r.price_per_sqft) },
  { field: "square_footage", label: "Living area", format: (r) => `${formatNumber(r.square_footage)} sq ft` },
  { field: "bedrooms", label: "Bedrooms", format: (r) => String(r.bedrooms) },
  { field: "bathrooms", label: "Bathrooms", format: (r) => formatNumber(r.bathrooms) },
  { field: "year_built", label: "Year built", format: (r) => String(r.year_built) },
  { field: "lot_size", label: "Lot size", format: (r) => `${formatNumber(r.lot_size)} sq ft` },
  {
    field: "distance_to_city_center",
    label: "Distance",
    description: "Distance to city centre",
    format: (r) => `${formatNumber(r.distance_to_city_center)} mi`,
  },
  { field: "school_rating", label: "School", description: "School rating", format: (r) => formatNumber(r.school_rating) },
];

/** Sorted by one column, then by home number, as market-api sorts its exports. */
export function sortRows(rows: readonly PropertyRow[], sort: Sort): PropertyRow[] {
  const sign = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => (a[sort.field] - b[sort.field]) * sign || a.id - b.id);
}

/** Header clicks: a new column starts ascending, the current one flips. */
export function nextSort(current: Sort, field: SortField): Sort {
  return current.field === field
    ? { field, direction: current.direction === "asc" ? "desc" : "asc" }
    : { field, direction: "asc" };
}

function searchText(row: PropertyRow): string {
  // Raw and formatted values, so "1550", "1,550" and "$245" all match.
  const raw = COLUMNS.map((c) => String(row[c.field]));
  return [...raw, ...COLUMNS.map((c) => c.format(row))].join(" ").toLowerCase();
}

/** Homes whose values contain every word of the query, e.g. "4 2010" or "#17". */
export function searchRows(rows: readonly PropertyRow[], query: string): PropertyRow[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [...rows];
  }
  return rows.filter((row) => {
    const text = searchText(row);
    return words.every((word) => text.includes(word));
  });
}

export type PageSlice = { rows: PropertyRow[]; page: number; pages: number; from: number; to: number };

/** One page of rows; a page past the end shows the last one. */
export function pageOf(rows: readonly PropertyRow[], page: number, size: number): PageSlice {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(1, page), pages);
  const start = (current - 1) * size;
  const slice = rows.slice(start, start + size);
  return { rows: slice, page: current, pages, from: slice.length ? start + 1 : 0, to: start + slice.length };
}
