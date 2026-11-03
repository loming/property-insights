import type { Metadata } from "next";
import { connection } from "next/server";

import { EstimateForm } from "@/features/estimator/estimate-form";
import { ModelSummary } from "@/features/estimator/model-summary";
import { getServerEnv } from "@/lib/api/env";
import { getModelInfo } from "@/lib/api/estimator";

export const metadata: Metadata = { title: "Estimate a property" };

/**
 * The form gets the model's training ranges and price distribution from the server (RSC), so nothing
 * extra loads in the browser. If estimator-api is down, estimator/error.tsx takes over this app only.
 */
export default async function EstimatePage() {
  await connection();
  const model = await getModelInfo();
  const ridge = getServerEnv().APP_VARIANT === "ridge";
  const trainingRanges = Object.fromEntries(model.features.map((f) => [f.name, { min: f.training_min, max: f.training_max }]));
  return (
    <div className="space-y-10">
      <EstimateForm distribution={model.price_distribution} trainingRanges={trainingRanges} showContributions={ridge} />
      <ModelSummary model={model} />
    </div>
  );
}
