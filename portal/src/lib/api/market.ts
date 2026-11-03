import "server-only";

import { apiFetch } from "./client";

/** App 2's backend (market-api). App 1's code must not import this (see eslint.config.mjs). */

export type MarketHealth = { status: "UP" | "DOWN" | "OUT_OF_SERVICE" | "UNKNOWN" };

export type MarketSummary = {
  count: number;
  price: { mean: number; median: number; min: number; max: number; q1: number; q3: number } | null;
  mean_price_per_sqft: number | null;
  mean_square_footage: number | null;
  mean_school_rating: number | null;
};

export function getMarketHealth(): Promise<MarketHealth> {
  return apiFetch<MarketHealth>("market", "/actuator/health", { timeoutMs: 3_000 });
}

/** Aggregates of an immutable dataset: cached for 5 minutes, tagged "market". */
export function getMarketSummary(): Promise<MarketSummary> {
  return apiFetch<MarketSummary>("market", "/api/v1/market/summary", { revalidate: 300, tags: ["market"] });
}
