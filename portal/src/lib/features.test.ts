import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CURRENT_YEAR, FEATURES } from "./features";

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
