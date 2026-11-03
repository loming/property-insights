/**
 * The model's input features as the portal shows them. Limits mirror ml-api's features.py, which
 * features.test.ts checks; labels and hints are written for people filling in a form.
 */
export const CURRENT_YEAR = new Date().getFullYear();

export type FeatureName =
  | "square_footage"
  | "bedrooms"
  | "bathrooms"
  | "year_built"
  | "lot_size"
  | "distance_to_city_center"
  | "school_rating";

export type Feature = {
  name: FeatureName;
  label: string;
  /** Shown after the value, e.g. "sq ft"; empty for plain counts. */
  unit: string;
  integer: boolean;
  min: number;
  max: number;
  /** The input's step: 1 for whole numbers, 0.5 for bathrooms, "any" otherwise. */
  step: number | "any";
  hint: string;
  /** Test-CSV row 1: a typical home, used as the form's starting values. */
  example: number;
};

export const FEATURES: readonly Feature[] = [
  { name: "square_footage", label: "Living area", unit: "sq ft", integer: true, min: 200, max: 20_000, step: 1, hint: "Interior floor area", example: 1550 },
  { name: "bedrooms", label: "Bedrooms", unit: "", integer: true, min: 0, max: 20, step: 1, hint: "Whole bedrooms", example: 3 },
  { name: "bathrooms", label: "Bathrooms", unit: "", integer: false, min: 0, max: 20, step: 0.5, hint: "A half bath counts as 0.5", example: 2 },
  { name: "year_built", label: "Year built", unit: "", integer: true, min: 1800, max: CURRENT_YEAR, step: 1, hint: "The year construction finished", example: 1997 },
  { name: "lot_size", label: "Lot size", unit: "sq ft", integer: false, min: 0, max: 1_000_000, step: "any", hint: "Land area, including the building", example: 6800 },
  { name: "distance_to_city_center", label: "Distance to city centre", unit: "miles", integer: false, min: 0, max: 200, step: "any", hint: "Straight-line distance", example: 4.1 },
  { name: "school_rating", label: "School rating", unit: "out of 10", integer: false, min: 0, max: 10, step: "any", hint: "Local school quality, 0 to 10", example: 7.6 },
];

export const FEATURE_BY_NAME = Object.fromEntries(FEATURES.map((f) => [f.name, f])) as Record<FeatureName, Feature>;

export const EXAMPLE_FEATURES = Object.fromEntries(FEATURES.map((f) => [f.name, f.example])) as Record<FeatureName, number>;
