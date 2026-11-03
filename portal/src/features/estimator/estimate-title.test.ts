import { describe, expect, it } from "vitest";

import { EXAMPLE_FEATURES } from "@/lib/features";

import { estimateTitle, homeSummary } from "./estimate-title";

describe("estimateTitle", () => {
  it("uses the label when there is one", () => {
    expect(estimateTitle({ label: "Flat on Elm St", features: EXAMPLE_FEATURES })).toBe("Flat on Elm St");
  });

  it("describes the home when there's no label", () => {
    expect(estimateTitle({ label: null, features: EXAMPLE_FEATURES })).toBe("1,550 sq ft, 3 bed home");
  });
});

describe("homeSummary", () => {
  it("lists size, rooms and age", () => {
    expect(homeSummary(EXAMPLE_FEATURES)).toBe("1,550 sq ft · 3 bed · 2 bath · built 1997");
  });
});
