import { describe, expect, it } from "vitest";

import { pearson } from "./stats";

describe("pearson", () => {
  it("measures a linear relationship", () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1);
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1);
    expect(pearson([1, 2, 3, 4], [1, 3, 2, 4])).toBeCloseTo(0.8);
  });

  it("is undefined for too few points or a flat series", () => {
    expect(pearson([1, 2], [3, 4])).toBeNull();
    expect(pearson([1, 2, 3], [5, 5, 5])).toBeNull();
  });
});
