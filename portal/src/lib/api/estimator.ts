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
  notes: string[];
};

export function getEstimatorHealth(): Promise<EstimatorHealth> {
  return apiFetch<EstimatorHealth>("estimator", "/health", { timeoutMs: 3_000 });
}

/** Changes only when the model is rebuilt: cached for an hour, tagged for revalidation. */
export function getModelInfo(): Promise<ModelInfo> {
  return apiFetch<ModelInfo>("estimator", "/api/v1/model-info", { revalidate: 3_600, tags: ["model-info"] });
}
