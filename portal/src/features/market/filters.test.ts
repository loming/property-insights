import { describe, expect, it } from "vitest";

import {
  describeFilters,
  FILTER_PARAMS,
  filterSearchParams,
  formatSort,
  hasFilters,
  parseFilters,
  parseSort,
  RANGE_FILTERS,
  roundToStep,
  sliderBounds,
} from "./filters";

describe("parseFilters", () => {
  it("reads repeated and comma-separated bedrooms, deduped and sorted", () => {
    expect(parseFilters(new URLSearchParams("bedrooms=4&bedrooms=2,3&bedrooms=2")).bedrooms).toEqual([2, 3, 4]);
    expect(parseFilters({ bedrooms: ["3", "x", "-1", "21", "2.5"] }).bedrooms).toEqual([3]);
  });

  it("keeps valid ranges and drops what market-api would reject", () => {
    const filters = parseFilters({
      min_price: "200000",
      max_price: "300000",
      min_year: "1990.5",
      max_year: "2010",
      max_school_rating: "11",
      min_sqft: "-5",
      max_sqft: "abc",
      min_distance: "",
    });
    expect(filters).toEqual({ bedrooms: [], min_price: 200_000, max_price: 300_000, max_year: 2010 });
  });

  it("ignores an inverted range rather than failing the page", () => {
    expect(parseFilters({ min_price: "300000", max_price: "200000", min_bathrooms: "2" })).toEqual({
      bedrooms: [],
      min_bathrooms: 2,
    });
  });

  it("round-trips through the query string in a fixed order", () => {
    const query = "max_price=300000&bedrooms=3&min_school_rating=7.5&bedrooms=2";
    const params = filterSearchParams(parseFilters(new URLSearchParams(query)));
    expect(params.toString()).toBe("bedrooms=2&bedrooms=3&max_price=300000&min_school_rating=7.5");
    expect(parseFilters(params)).toEqual(parseFilters(new URLSearchParams(query)));
  });

  it("knows every filter parameter, and only those", () => {
    expect(FILTER_PARAMS).toHaveLength(13);
    expect(hasFilters(parseFilters({ sort: "price,desc", segment: "decade" }))).toBe(false);
    expect(hasFilters(parseFilters({ min_distance: "3" }))).toBe(true);
  });
});

describe("describeFilters", () => {
  it("says each active filter in words", () => {
    const filters = parseFilters({
      bedrooms: ["2", "3", "4"],
      min_price: "200000",
      max_price: "300000",
      min_year: "1990",
      max_distance: "5",
      min_bathrooms: "2",
      max_bathrooms: "2",
    });
    expect(describeFilters(filters)).toEqual([
      "2, 3 or 4 bedrooms",
      "Price $200,000 to $300,000",
      "Bathrooms 2",
      "Year built at least 1990",
      "Distance to city centre up to 5 miles",
    ]);
  });

  it("is empty without filters", () => {
    expect(describeFilters(parseFilters({}))).toEqual([]);
  });
});

describe("sliderBounds", () => {
  const range = (name: string) => RANGE_FILTERS.find((r) => r.name === name)!;

  it("widens the data's range to whole steps", () => {
    expect(sliderBounds(range("price"), { min: 162_500, max: 410_000 })).toEqual({ min: 160_000, max: 410_000 });
    expect(sliderBounds(range("sqft"), { min: 985, max: 2_401 })).toEqual({ min: 980, max: 2_410 });
  });

  it("keeps decimal steps exact", () => {
    expect(sliderBounds(range("school"), { min: 6.5, max: 9.1 })).toEqual({ min: 6.5, max: 9.1 });
    expect(sliderBounds(range("distance"), { min: 2.1, max: 8.2 })).toEqual({ min: 2.1, max: 8.2 });
    expect(roundToStep(0.1 + 0.2, 0.1)).toBe(0.3);
    expect(roundToStep(7.499999999999999, 0.5)).toBe(7.5);
  });
});

describe("parseSort", () => {
  it("accepts market-api's sort fields and falls back to id order", () => {
    expect(parseSort("price,desc")).toEqual({ field: "price", direction: "desc" });
    expect(parseSort(["year_built,asc", "price,desc"])).toEqual({ field: "year_built", direction: "asc" });
    expect(parseSort("price")).toEqual({ field: "id", direction: "asc" });
    expect(parseSort("password,asc")).toEqual({ field: "id", direction: "asc" });
    expect(parseSort(undefined)).toEqual({ field: "id", direction: "asc" });
    expect(formatSort(parseSort("lot_size,desc"))).toBe("lot_size,desc");
  });
});
