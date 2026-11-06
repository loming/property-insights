import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CURRENT_YEAR, FEATURES, warningText } from "./features";

describe("warningText", () => {
  it("leads with the feature's label when the warning names one", () => {
    expect(warningText({ field: "bedrooms", message: "Out of range." })).toBe("Bedrooms: Out of range.");
  });

  it("is just the message when it names no feature, or one the portal doesn't know", () => {
    expect(warningText({ field: null, message: "Unusual." })).toBe("Unusual.");
    expect(warningText({ message: "Unusual." })).toBe("Unusual.");
    expect(warningText({ field: "garage", message: "Unusual." })).toBe("Unusual.");
  });
});

const ML_API_FEATURES = path.resolve(import.meta.dirname, "../../../ml-api/src/ml_api/features.py");
const PATTERN =
  /Feature\("([a-z_]+)", "[^"]+", "[^"]+", (True|False), ([0-9_]+), ([0-9_]+|CURRENT_YEAR)(?:, ([0-9.]+))?\)/g;

/** Contract: the form must accept exactly what ml-api accepts, or users see the model's errors instead. */
describe.skipIf(!existsSync(ML_API_FEATURES))("features match ml-api", () => {
  it("has the same names, types and limits", () => {
    const python = [...readFileSync(ML_API_FEATURES, "utf8").matchAll(PATTERN)].map((m) => ({
      name: m[1],
      integer: m[2] === "True",
      min: Number(m[3].replaceAll("_", "")),
      max: m[4] === "CURRENT_YEAR" ? CURRENT_YEAR : Number(m[4].replaceAll("_", "")),
      half: m[5] === "0.5",
    }));
    const portal = FEATURES.map((f) => ({ name: f.name, integer: f.integer, min: f.min, max: f.max, half: f.step === 0.5 }));
    expect(python).toHaveLength(7);
    expect(portal).toEqual(python);
  });
});
