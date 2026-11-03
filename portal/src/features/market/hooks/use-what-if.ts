"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { postJson } from "@/lib/api/browser";
import type { HomeFeatures, SensitivityResult, WhatIfResult } from "@/lib/api/market";
import { ApiError } from "@/lib/api/problem";
import type { FeatureName } from "@/lib/features";

import { changesFrom } from "../what-if-model";

const DEBOUNCE_MS = 300;

/**
 * A model that's down (503) or confused (502), or the gateway's rate limit (429), may answer a moment
 * later; a refused input won't.
 */
function retryServerErrors(failures: number, error: Error): boolean {
  return failures < 1 && error instanceof ApiError && (error.status >= 500 || error.status === 429);
}

/**
 * M-3: the baseline's price and the scenario's, from one model call. Slider moves are debounced into
 * one request per pause; the cache is keyed by the inputs, so going back to a scenario costs nothing,
 * and the last result stays up while the next loads.
 */
export function useWhatIf(baseline: HomeFeatures, scenario: HomeFeatures) {
  const key = JSON.stringify({ baseline, changes: changesFrom(baseline, scenario) });
  const settled = useDebouncedValue(key, DEBOUNCE_MS);
  const query = useQuery({
    queryKey: ["what-if", settled],
    queryFn: ({ signal }) => postJson<WhatIfResult>("market", "/api/market/what-if", JSON.parse(settled), signal),
    placeholderData: keepPreviousData,
    retry: retryServerErrors,
    staleTime: 10 * 60_000,
  });
  // Waiting for the debounce counts as loading too, so the result never shows as current when it isn't.
  return { ...query, isUpdating: query.isFetching || settled !== key };
}

/** The Ridge set's sensitivity line: one feature swept across its range, the rest held at the scenario. */
export function useSensitivity(
  scenario: HomeFeatures,
  feature: FeatureName,
  range: { min: number; max: number },
  steps: number,
) {
  const key = JSON.stringify({ baseline: scenario, feature, from: range.min, to: range.max, steps });
  const settled = useDebouncedValue(key, DEBOUNCE_MS);
  return useQuery({
    queryKey: ["sensitivity", settled],
    queryFn: ({ signal }) =>
      postJson<SensitivityResult>("market", "/api/market/what-if/sensitivity", JSON.parse(settled), signal),
    placeholderData: keepPreviousData,
    retry: retryServerErrors,
    staleTime: 10 * 60_000,
  });
}
