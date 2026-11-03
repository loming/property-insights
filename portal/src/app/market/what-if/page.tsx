import type { Metadata } from "next";
import { connection } from "next/server";

import { buildBaselines, type FeatureRanges, pickBaseline } from "@/features/market/what-if-model";
import { WhatIfPanel } from "@/features/market/what-if-panel";
import { getServerEnv } from "@/lib/api/env";
import { getFilterOptions, getMarketModelInfo, getProperties, getSegmentMedians } from "@/lib/api/market";
import { FEATURES, type FeatureName } from "@/lib/features";

export const metadata: Metadata = { title: "What-if analysis" };

/**
 * M-3. The baselines and slider ranges come from market-api's own data, so the page still opens when
 * the model is down; only the prices then say it isn't answering (P-0's graceful degradation).
 */
export default async function WhatIfPage({ searchParams }: PageProps<"/market/what-if">) {
  await connection();
  const params = await searchParams;
  const [options, medians, homes, model] = await Promise.all([
    getFilterOptions(),
    getSegmentMedians("bedrooms"),
    getProperties(),
    // The coefficients only annotate the result; without them the tool still works.
    getMarketModelInfo().catch(() => null),
  ]);
  const baselines = buildBaselines(medians.segments, homes.items);
  const ranges = Object.fromEntries(FEATURES.map((f) => [f.name, options.ranges[f.name]])) as FeatureRanges;
  const ridge = getServerEnv().APP_VARIANT === "ridge";
  const feature = FEATURES.find((f) => f.name === params.feature)?.name ?? ("square_footage" satisfies FeatureName);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold">What-if analysis</h1>
        <p className="max-w-prose text-muted-foreground">
          Start from a typical home or one from the data, change its features and see how the model&apos;s price moves.
          Each change is priced with every other feature held where it is: it shows what the model has learned, not
          what a real renovation would do to a price.
        </p>
      </div>
      <WhatIfPanel
        baselines={baselines}
        initialBaselineId={pickBaseline(baselines, params.baseline)!.id}
        ranges={ranges}
        model={model}
        sensitivity={ridge ? { feature } : null}
      />
    </div>
  );
}
