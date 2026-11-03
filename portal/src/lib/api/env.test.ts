import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getServerEnv, resetServerEnv } from "./env";

beforeEach(() => {
  resetServerEnv();
  vi.stubEnv("ESTIMATOR_API_URL", "http://estimator-api:8001");
  vi.stubEnv("MARKET_API_URL", "http://market-api:8080");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getServerEnv", () => {
  it("parses the backend URLs and defaults to the brief set", () => {
    expect(getServerEnv()).toEqual({
      ESTIMATOR_API_URL: "http://estimator-api:8001",
      MARKET_API_URL: "http://market-api:8080",
      APP_VARIANT: "brief",
    });
  });

  it("reads the Ridge set's settings", () => {
    vi.stubEnv("APP_VARIANT", "ridge");
    vi.stubEnv("OTHER_VARIANT_URL", "https://hsbc.loming.com");
    expect(getServerEnv()).toMatchObject({ APP_VARIANT: "ridge", OTHER_VARIANT_URL: "https://hsbc.loming.com" });
  });

  it("fails on first use, naming the bad variable", () => {
    vi.stubEnv("MARKET_API_URL", "not a url");
    expect(() => getServerEnv()).toThrow(/MARKET_API_URL/);
    vi.stubEnv("MARKET_API_URL", "http://market-api:8080");
    vi.stubEnv("APP_VARIANT", "lasso");
    resetServerEnv();
    expect(() => getServerEnv()).toThrow(/APP_VARIANT/);
  });

  it("validates once and then reuses the result", () => {
    const first = getServerEnv();
    vi.stubEnv("MARKET_API_URL", "not a url");
    expect(getServerEnv()).toBe(first);
  });
});
