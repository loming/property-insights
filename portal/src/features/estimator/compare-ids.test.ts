import { describe, expect, it } from "vitest";

import { compareHref, parseCompareIds } from "./compare-ids";

const a = "ef2ecc09-f85f-471b-95de-b97ca82d06df";
const b = "00000000-0000-4000-8000-000000000001";
const c = "00000000-0000-4000-8000-000000000002";
const d = "00000000-0000-4000-8000-000000000003";
const e = "00000000-0000-4000-8000-000000000004";

describe("parseCompareIds", () => {
  it("reads comma-separated and repeated ids", () => {
    expect(parseCompareIds(`${a},${b}`)).toEqual([a, b]);
    expect(parseCompareIds([a, `${b},${c}`])).toEqual([a, b, c]);
  });

  it("ignores anything that isn't a UUID, and duplicates", () => {
    expect(parseCompareIds(`${a}, nope ,${a.toUpperCase()},,${b}`)).toEqual([a, b]);
    expect(parseCompareIds(undefined)).toEqual([]);
  });

  it("keeps the first four", () => {
    expect(parseCompareIds([a, b, c, d, e].join(","))).toEqual([a, b, c, d]);
  });

  it("round-trips through compareHref", () => {
    expect(compareHref([a, b])).toBe(`/estimator/compare?ids=${a},${b}`);
  });
});
