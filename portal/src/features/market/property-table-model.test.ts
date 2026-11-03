import { describe, expect, it } from "vitest";

import type { PropertyRow } from "@/lib/api/market";

import { nextSort, pageOf, searchRows, sortRows } from "./property-table-model";

function home(id: number, overrides: Partial<PropertyRow> = {}): PropertyRow {
  return {
    id,
    square_footage: 1550,
    bedrooms: 3,
    bathrooms: 2,
    year_built: 1997,
    lot_size: 6800,
    distance_to_city_center: 4.1,
    school_rating: 7.6,
    price: 245_000,
    price_per_sqft: 158.06,
    ...overrides,
  };
}

const rows = [
  home(1, { price: 300_000, year_built: 2010 }),
  home(2, { price: 200_000, bedrooms: 2 }),
  home(3, { price: 300_000, square_footage: 2400 }),
  home(17, { price: 410_000, bedrooms: 4 }),
];

describe("sortRows", () => {
  it("sorts by the column, then by home number", () => {
    expect(sortRows(rows, { field: "price", direction: "asc" }).map((r) => r.id)).toEqual([2, 1, 3, 17]);
    expect(sortRows(rows, { field: "price", direction: "desc" }).map((r) => r.id)).toEqual([17, 1, 3, 2]);
  });

  it("leaves the input alone", () => {
    sortRows(rows, { field: "price", direction: "desc" });
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3, 17]);
  });
});

describe("nextSort", () => {
  it("starts a new column ascending and flips the current one", () => {
    expect(nextSort({ field: "id", direction: "asc" }, "price")).toEqual({ field: "price", direction: "asc" });
    expect(nextSort({ field: "price", direction: "asc" }, "price")).toEqual({ field: "price", direction: "desc" });
  });
});

describe("searchRows", () => {
  it("matches raw and formatted values, every word", () => {
    expect(searchRows(rows, "2010").map((r) => r.id)).toEqual([1]);
    expect(searchRows(rows, "2,400").map((r) => r.id)).toEqual([3]);
    expect(searchRows(rows, "#17").map((r) => r.id)).toEqual([17]);
    expect(searchRows(rows, "$300,000 2010").map((r) => r.id)).toEqual([1]);
    expect(searchRows(rows, "  ")).toHaveLength(4);
    expect(searchRows(rows, "mansion")).toEqual([]);
  });
});

describe("pageOf", () => {
  const many = Array.from({ length: 23 }, (_, i) => home(i + 1));

  it("slices a page and says which rows it holds", () => {
    expect(pageOf(many, 1, 10)).toMatchObject({ page: 1, pages: 3, from: 1, to: 10 });
    expect(pageOf(many, 3, 10)).toMatchObject({ page: 3, pages: 3, from: 21, to: 23 });
  });

  it("shows the last page for a page past the end, and copes with no rows", () => {
    expect(pageOf(many, 9, 10).page).toBe(3);
    expect(pageOf([], 1, 10)).toMatchObject({ rows: [], page: 1, pages: 1, from: 0, to: 0 });
  });
});
