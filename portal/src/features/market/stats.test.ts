import { describe, expect, it } from "vitest";

import { niceTicks, pearson } from "./stats";

describe("niceTicks", () => {
  it("puts about five round ticks inside the range", () => {
    expect(niceTicks(6.5, 9.1)).toEqual([6.5, 7, 7.5, 8, 8.5, 9]);
    expect(niceTicks(1978, 2012)).toEqual([1980, 1990, 2000, 2010]);
    expect(niceTicks(980, 2400)).toEqual([1000, 1250, 1500, 1750, 2000, 2250]);
  });

  it("is never finer than the step", () => {
    expect(niceTicks(2, 4, 1)).toEqual([2, 3, 4]);
    expect(niceTicks(1, 3, 0.5)).toEqual([1, 1.5, 2, 2.5, 3]);
  });
});

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
