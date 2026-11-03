import { describe, expect, it } from "vitest";

import { sensitivityRequestSchema, whatIfRequestSchema } from "./what-if-schema";

const baseline = {
  square_footage: 1625,
  bedrooms: 3,
  bathrooms: 2,
  year_built: 1997,
  lot_size: 6900,
  distance_to_city_center: 3.9,
  school_rating: 7.55,
};

describe("whatIfRequestSchema", () => {
  it("accepts a baseline and any subset of changes", () => {
    expect(whatIfRequestSchema.safeParse({ baseline, changes: {} }).success).toBe(true);
    expect(whatIfRequestSchema.safeParse({ baseline, changes: { square_footage: 2000, bathrooms: 2.5 } }).success).toBe(true);
  });

  it("applies the model's limits and rejects unknown fields", () => {
    const paths = (body: unknown) => whatIfRequestSchema.safeParse(body).error?.issues.map((i) => i.path.join("."));
    expect(paths({ baseline, changes: { bathrooms: 2.3 } })).toEqual(["changes.bathrooms"]);
    expect(paths({ baseline: { ...baseline, bedrooms: 2.5 }, changes: {} })).toEqual(["baseline.bedrooms"]);
    expect(paths({ baseline, changes: { garage: 1 } })).toEqual(["changes"]);
    expect(paths({ baseline: { ...baseline, school_rating: 11 }, changes: {} })).toEqual(["baseline.school_rating"]);
  });
});

describe("sensitivityRequestSchema", () => {
  it("sweeps a known feature within its limits, in 2 to 50 steps", () => {
    const body = { baseline, feature: "square_footage", from: 980, to: 2400, steps: 21 };
    expect(sensitivityRequestSchema.safeParse(body).success).toBe(true);
    expect(sensitivityRequestSchema.safeParse({ ...body, feature: "garage" }).success).toBe(false);
    expect(sensitivityRequestSchema.safeParse({ ...body, steps: 51 }).success).toBe(false);
    expect(sensitivityRequestSchema.safeParse({ ...body, feature: "school_rating", from: 5, to: 12 }).success).toBe(false);
  });
});
