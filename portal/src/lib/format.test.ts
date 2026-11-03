import { describe, expect, it } from "vitest";

import { formatFeatureValue } from "./features";
import { formatDateTime, formatNumber, formatPrice } from "./format";

describe("format", () => {
  it("formats prices as whole US dollars", () => {
    expect(formatPrice(250879.73)).toBe("$250,880");
  });

  it("formats numbers with up to two decimals, or a fixed number", () => {
    expect(formatNumber(1550)).toBe("1,550");
    expect(formatNumber(4.125)).toBe("4.13");
    expect(formatNumber(2.5, 1)).toBe("2.5");
  });

  it("prints years without a thousands separator", () => {
    expect(formatFeatureValue("year_built", 1997)).toBe("1997");
    expect(formatFeatureValue("lot_size", 6800)).toBe("6,800");
  });

  it("formats a timestamp in the given time zone, naming it", () => {
    expect(formatDateTime("2026-11-03T03:45:41.806913Z", "UTC")).toBe("Nov 3, 2026, 3:45 AM UTC");
    expect(formatDateTime("2026-11-03T03:45:41Z", "Asia/Hong_Kong")).toBe("Nov 3, 2026, 11:45 AM GMT+8");
  });
});
