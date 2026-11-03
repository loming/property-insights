import "server-only";

import { apiFetch } from "./client";

/** App 1's backend (estimator-api). App 2's code must not import this (see eslint.config.mjs). */

export type EstimatorHealth = {
  status: "ok" | "degraded";
  database: "up" | "down";
  ml_api: "up" | "down";
};

export type FeatureInfo = {
  name: string;
  label: string;
  unit: string;
  training_min: number;
  training_max: number;
  mean: number;
  allowed_min: number;
  allowed_max: number;
  step: number | null;
};

export type Coefficient = { feature: string; per_unit: number; unit: string; standardised?: number };

export type ModelInfo = {
  model_type: "linear_regression" | "ridge";
  model_version: string;
  trained_at: string;
  training_rows: number;
  intercept: number;
  baseline_at_mean: number;
  coefficients: Coefficient[];
  features: FeatureInfo[];
  metrics: { cv: { r2: { mean: number }; rmse: { mean: number }; mae: { mean: number } } };
  price_distribution: { bin_edges: number[]; counts: number[] };
  notes: string[];
};

export type PredictionWarning = {
  code: "OUTSIDE_TRAINING_RANGE" | "UNUSUAL_COMBINATION" | string;
  field?: string | null;
  value?: number | null;
  message: string;
};

export type Estimate = {
  id: string;
  label: string | null;
  features: Record<string, number>;
  predicted_price: number;
  currency: "USD";
  model_version: string;
  warnings: PredictionWarning[];
  contributions: { baseline: number; by_feature: Record<string, number> } | null;
  created_at: string;
};

export type EstimatePage = { items: Estimate[]; total: number; limit: number; offset: number };

export type Comparison = {
  estimates: Estimate[];
  missing_ids: string[];
  ranges: Record<string, { min: number; max: number }>;
};

export function getEstimatorHealth(): Promise<EstimatorHealth> {
  return apiFetch<EstimatorHealth>("estimator", "/health", { timeoutMs: 3_000 });
}

/** Changes only when the model is rebuilt: cached for an hour, tagged for revalidation. */
export function getModelInfo(): Promise<ModelInfo> {
  return apiFetch<ModelInfo>("estimator", "/api/v1/model-info", { revalidate: 3_600, tags: ["model-info"] });
}

// History is per user action, so these are never cached.

export function createEstimate(body: { label?: string; features: Record<string, number> }): Promise<Estimate> {
  return apiFetch<Estimate>("estimator", "/api/v1/estimates", { method: "POST", body });
}

export function listEstimates(limit: number, offset: number): Promise<EstimatePage> {
  return apiFetch<EstimatePage>("estimator", `/api/v1/estimates?limit=${limit}&offset=${offset}`);
}

export function getEstimate(id: string): Promise<Estimate> {
  return apiFetch<Estimate>("estimator", `/api/v1/estimates/${encodeURIComponent(id)}`);
}

export function compareEstimates(ids: string[]): Promise<Comparison> {
  const query = ids.map((id) => `ids=${encodeURIComponent(id)}`).join("&");
  return apiFetch<Comparison>("estimator", `/api/v1/estimates/compare?${query}`);
}

export function deleteEstimate(id: string): Promise<void> {
  return apiFetch<void>("estimator", `/api/v1/estimates/${encodeURIComponent(id)}`, { method: "DELETE" });
}
