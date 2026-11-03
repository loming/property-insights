import { describe, expect, it } from "vitest";

import { EXAMPLE_FEATURES } from "@/lib/features";

import { estimateSchema } from "./schema";

function errors(input: unknown): Record<string, string> {
  const result = estimateSchema.safeParse(input);
  if (result.success) {
    return {};
  }
  return Object.fromEntries(result.error.issues.map((i) => [i.path.join("."), i.message]));
}

describe("estimateSchema", () => {
  it("accepts the example home, with or without a label", () => {
    expect(errors({ features: EXAMPLE_FEATURES })).toEqual({});
    const parsed = estimateSchema.parse({ label: "  Flat on Elm St  ", features: EXAMPLE_FEATURES });
    expect(parsed.label).toBe("Flat on Elm St");
  });

  it("treats a blank label as none", () => {
    expect(estimateSchema.parse({ label: "   ", features: EXAMPLE_FEATURES }).label).toBeUndefined();
  });

  it("says what to enter for an empty field (the browser sends NaN)", () => {
    expect(errors({ features: { ...EXAMPLE_FEATURES, lot_size: Number.NaN } })).toEqual({
      "features.lot_size": "Enter the lot size",
    });
  });

  it("enforces whole numbers, half steps and ranges", () => {
    expect(errors({ features: { ...EXAMPLE_FEATURES, bedrooms: 2.5 } })).toEqual({
      "features.bedrooms": "Enter a whole number",
    });
    expect(errors({ features: { ...EXAMPLE_FEATURES, bathrooms: 2.25 } })).toEqual({
      "features.bathrooms": "Use steps of 0.5, such as 2 or 2.5",
    });
    expect(errors({ features: { ...EXAMPLE_FEATURES, square_footage: 150 } })).toEqual({
      "features.square_footage": "Enter at least 200 sq ft",
    });
    expect(errors({ features: { ...EXAMPLE_FEATURES, school_rating: 11 } })).toEqual({
      "features.school_rating": "Enter at most 10 out of 10",
    });
    expect(errors({ features: { ...EXAMPLE_FEATURES, year_built: new Date().getFullYear() + 1 } })).toHaveProperty(
      "features.year_built",
    );
  });

  it("rejects multi-line and long labels", () => {
    expect(errors({ label: "a\nb", features: EXAMPLE_FEATURES })).toEqual({ label: "Keep the label to one line" });
    expect(errors({ label: "x".repeat(81), features: EXAMPLE_FEATURES })).toEqual({ label: "Keep the label to 80 characters" });
  });
});
