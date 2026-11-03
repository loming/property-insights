import type { Metadata } from "next";

import { ComingNext } from "@/components/layout/coming-next";
import { ModelSummary } from "@/features/estimator/model-summary";
import { getModelInfo } from "@/lib/api/estimator";

export const metadata: Metadata = { title: "Estimate a property" };

/** Loaded on the server through estimator-api; if it's down, estimator/error.tsx takes over this app only. */
export default async function EstimatePage() {
  const model = await getModelInfo();
  return (
    <div className="space-y-8">
      <ComingNext title="Estimate a property">
        The estimate form, with validation and results as a table and a chart, arrives in the next phase.
      </ComingNext>
      <ModelSummary model={model} />
    </div>
  );
}
