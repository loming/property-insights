"use client";

import { cn } from "cn";
import Link from "next/link";

import { useFormatters } from "@/hooks/use-formatters";
import type { Comparison, Estimate } from "@/lib/api/estimator";
import { FEATURES, formatFeatureValue } from "@/lib/features";

import { CompareFeaturesChart, ComparePriceChart, SERIES, SeriesSwatch } from "./comparison-charts";
import { estimateTitle } from "./estimate-title";

type Row = { key: string; label: string; unit: string; format: (value: number) => string };

/**
 * E-5: the estimates in columns. In every row where they differ, the highest and lowest values are
 * marked in words as well as weight; rows that are the same for all say so.
 */
export function ComparisonView({
  comparison,
  trainingRanges,
  trainingRows,
}: {
  comparison: Comparison;
  trainingRanges: Record<string, { min: number; max: number }>;
  trainingRows: number;
}) {
  const fmt = useFormatters();
  const { estimates, ranges } = comparison;
  const rows: Row[] = [
    { key: "predicted_price", label: "Estimated price", unit: "", format: fmt.price },
    ...FEATURES.map((f) => ({
      key: f.name,
      label: f.label,
      unit: f.unit,
      format: (value: number) => formatFeatureValue(f.name, value),
    })),
  ];
  const valueOf = (estimate: Estimate, key: string) =>
    key === "predicted_price" ? estimate.predicted_price : estimate.features[key];

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <caption className="sr-only">
            The estimates side by side. Where they differ, the highest and lowest values are marked.
          </caption>
          <thead>
            <tr className="border-b">
              <th scope="col" className="px-3 py-2 text-left font-medium text-muted-foreground">
                Feature
              </th>
              {estimates.map((estimate, i) => (
                <th key={estimate.id} scope="col" className="min-w-36 px-3 py-2 text-left align-bottom font-medium">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <SeriesSwatch index={i} />
                    {SERIES[i].letter}
                  </span>
                  <Link href={`/estimator/history/${estimate.id}`} className="underline-offset-4 hover:underline">
                    {estimateTitle(estimate)}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const range = ranges[row.key];
              const differs = range !== undefined && range.min !== range.max;
              return (
                <tr key={row.key} className={cn("border-b last:border-b-0", row.key === "predicted_price" && "bg-muted/40")}>
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    {row.label}
                    {!differs && <span className="block text-xs text-muted-foreground">Same for all</span>}
                  </th>
                  {estimates.map((estimate) => {
                    const value = valueOf(estimate, row.key);
                    const mark = differs ? (value === range.max ? "Highest" : value === range.min ? "Lowest" : null) : null;
                    return (
                      <td
                        key={estimate.id}
                        className={cn(
                          "px-3 py-2 tabular-nums",
                          row.key === "predicted_price" && "font-medium",
                          mark && "bg-accent font-semibold",
                        )}
                      >
                        {row.format(value)}
                        {row.unit && <span className="font-normal text-muted-foreground"> {row.unit}</span>}
                        {mark && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            <span aria-hidden="true">{mark === "Highest" ? "▲ " : "▼ "}</span>
                            {mark}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ComparePriceChart estimates={estimates} />
        <CompareFeaturesChart estimates={estimates} trainingRanges={trainingRanges} trainingRows={trainingRows} />
      </div>
    </div>
  );
}
