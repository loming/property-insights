import { describe, expect, it } from "vitest";

import type { MarketModelInfo, PropertyRow, SegmentMedian } from "@/lib/api/market";
import { ApiError } from "@/lib/api/problem";

import { buildBaselines, changesFrom, describeModelError, effectsOf, pickBaseline, sweepSteps } from "./what-if-model";

const typical: SegmentMedian = {
  segment: "3 bed",
  count: 22,
  median_price: 235_000,
  features: {
    square_footage: 1625,
    bedrooms: 3,
    bathrooms: 2,
    year_built: 1997,
    lot_size: 6900,
    distance_to_city_center: 3.9,
    school_rating: 7.55,
  },
};

const home: PropertyRow = {
  id: 7,
  square_footage: 2400,
  bedrooms: 4,
  bathrooms: 3,
  year_built: 2010,
  lot_size: 10_500,
  distance_to_city_center: 8.2,
  school_rating: 9,
  price: 410_000,
  price_per_sqft: 170.83,
};

describe("baselines", () => {
  const baselines = buildBaselines([typical], [home]);

  it("offers each segment's median home, then every listed home with its sale price", () => {
    expect(baselines.map((b) => [b.id, b.label])).toEqual([
      ["typical-3", "Typical 3 bed home (the median of 22)"],
      ["home-7", "Home #7: 2,400 sq ft, 4 bed, sold for $410,000"],
    ]);
    expect(baselines[1]!.soldFor).toBe(410_000);
    // Only the model's features: no id, price or price per sq ft.
    expect(Object.keys(baselines[1]!.features)).toHaveLength(7);
  });

  it("picks the URL's baseline, else the typical 3-bed home", () => {
    expect(pickBaseline(baselines, "home-7")?.id).toBe("home-7");
    expect(pickBaseline(baselines, "home-99")?.id).toBe("typical-3");
    expect(pickBaseline(baselines, undefined)?.id).toBe("typical-3");
  });
});

describe("changesFrom", () => {
  it("keeps only the features that differ", () => {
    const scenario = { ...typical.features, square_footage: 2000, school_rating: 7.55 };
    expect(changesFrom(typical.features, scenario)).toEqual({ square_footage: 2000 });
    expect(changesFrom(typical.features, typical.features)).toEqual({});
  });
});

describe("effectsOf", () => {
  it("multiplies each change by its coefficient, so the effects add up to the change", () => {
    const model = {
      coefficients: [
        { feature: "square_footage", per_unit: -102.92, unit: "sq ft" },
        { feature: "school_rating", per_unit: 21_062, unit: "0-10 scale" },
      ],
    } as MarketModelInfo;
    const effects = effectsOf({ square_footage: 2000, school_rating: 8.55 }, typical.features, model);
    expect(effects.map((e) => [e.name, Math.round(e.effect)])).toEqual([
      ["square_footage", -38_595],
      ["school_rating", 21_062],
    ]);
  });
});

describe("describeModelError", () => {
  const problem = (status: number) => new ApiError({ type: "x", title: "x", status, detail: "Predicted price is not positive" }, "market");

  it("tells a refused home, a busy gateway and a missing model apart", () => {
    expect(describeModelError(problem(422))).toEqual({
      title: "The model can't price this home",
      detail: "Predicted price is not positive",
    });
    expect(describeModelError(problem(429)).title).toBe("Too many requests at once");
    expect(describeModelError(problem(503)).title).toBe("The model isn't answering right now");
    expect(describeModelError(new Error("boom")).title).toBe("The model gave no usable answer");
  });
});

describe("sweepSteps", () => {
  it("uses every value a slider can take, up to 21 points", () => {
    expect(sweepSteps("bedrooms", { min: 2, max: 4 })).toBe(3);
    expect(sweepSteps("bathrooms", { min: 1, max: 3 })).toBe(5);
    expect(sweepSteps("square_footage", { min: 980, max: 2400 })).toBe(21);
  });
});
