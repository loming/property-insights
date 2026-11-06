"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";

import { useFormatters } from "@/hooks/use-formatters";
import type { Estimate } from "@/lib/api/estimator";
import { FEATURES, formatFeatureValue, warningText } from "@/lib/features";

import { AddToCompareButton } from "./add-to-compare-button";
import { ContributionChart } from "./contribution-chart";
import { estimateTitle } from "./estimate-title";
import { type PriceDistribution, PriceDistributionChart } from "./price-distribution-chart";

/** E-3: the result as a table and as charts, with the model's warnings first. */
export function EstimateResult({
  estimate,
  distribution,
  showContributions,
  justSaved = false,
}: {
  estimate: Estimate;
  distribution: PriceDistribution;
  showContributions: boolean;
  justSaved?: boolean;
}) {
  const fmt = useFormatters();
  return (
    <section aria-labelledby={`result-${estimate.id}`} className="space-y-4">
      <div className="space-y-1">
        <h2 id={`result-${estimate.id}`} className="font-heading text-lg font-semibold">
          {estimate.label ?? "Estimated price"}
        </h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="font-heading text-4xl font-semibold tabular-nums">{fmt.price(estimate.predicted_price)}</p>
          <AddToCompareButton id={estimate.id} title={estimateTitle(estimate)} />
        </div>
        <p className="text-sm text-muted-foreground">
          Model {estimate.model_version}
          {justSaved && (
            <>
              {" · Saved to your "}
              <Link href="/estimator/history" className="underline underline-offset-4">
                history
              </Link>
            </>
          )}
        </p>
      </div>

      {estimate.warnings.length > 0 && (
        <div className="rounded-lg border border-warning bg-warning/15 p-3 text-sm text-foreground">
          <p className="flex items-center gap-2 font-medium">
            <TriangleAlert aria-hidden="true" className="size-4" />
            Treat this estimate with caution
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-6">
            {estimate.warnings.map((warning, i) => (
              <li key={i}>{warningText(warning)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <caption className="sr-only">The property&apos;s features and its estimated price</caption>
            <tbody>
              {FEATURES.map((f) => (
                <tr key={f.name} className="border-b last:border-b-0">
                  <th scope="row" className="px-3 py-2 text-left font-normal text-muted-foreground">
                    {f.label}
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatFeatureValue(f.name, estimate.features[f.name])}
                    {f.unit && <span className="text-muted-foreground"> {f.unit}</span>}
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/50 font-medium">
                <th scope="row" className="px-3 py-2 text-left">
                  Estimated price
                </th>
                <td className="px-3 py-2 text-right tabular-nums">{fmt.price(estimate.predicted_price)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <PriceDistributionChart price={estimate.predicted_price} distribution={distribution} />
      </div>

      {showContributions && estimate.contributions && (
        <ContributionChart price={estimate.predicted_price} contributions={estimate.contributions} />
      )}
    </section>
  );
}
