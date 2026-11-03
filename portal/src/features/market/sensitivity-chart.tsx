"use client";

import { TriangleAlert } from "lucide-react";
import { useId, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartCard } from "@/components/chart-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { useFormatters } from "@/hooks/use-formatters";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useUrlState } from "@/hooks/use-url-state";
import type { HomeFeatures } from "@/lib/api/market";
import { FEATURE_BY_NAME, FEATURES, type FeatureName, formatFeatureValue } from "@/lib/features";
import { cn } from "@/lib/utils";

import { useSensitivity } from "./hooks/use-what-if";
import { niceTicks } from "./stats";
import { type FeatureRanges, SLIDER_STEPS, sweepSteps } from "./what-if-model";

type Point = { value: number; price: number; warned: boolean };

function withUnit(name: FeatureName, value: number): string {
  const unit = FEATURE_BY_NAME[name].unit;
  return `${formatFeatureValue(name, value)}${unit ? ` ${unit}` : ""}`;
}

/** A filled dot where the model is on familiar ground; a hollow one where it warns. */
function PointDot({ cx, cy, payload }: { cx?: number; cy?: number; payload?: Point }) {
  if (cx === undefined || cy === undefined || !payload) {
    return null;
  }
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4.5}
      fill={payload.warned ? "var(--background)" : "var(--chart-1)"}
      stroke="var(--chart-1)"
      strokeWidth={2}
    />
  );
}

/**
 * M-3's sensitivity line, on the Ridge set: how the price moves as one feature runs across the data's
 * range, with the other six held at the scenario's values. One batch model call per line.
 */
export function SensitivityChart({
  scenario,
  initialFeature,
  ranges,
}: {
  scenario: HomeFeatures;
  initialFeature: FeatureName;
  ranges: FeatureRanges;
}) {
  const fmt = useFormatters();
  const reducedMotion = usePrefersReducedMotion();
  const { searchParams, replaceLocal } = useUrlState();
  const [feature, setFeature] = useState<FeatureName>(initialFeature);
  const id = useId();
  const range = ranges[feature];
  const { data, error, isFetching } = useSensitivity(scenario, feature, range, sweepSteps(feature, range));
  const label = FEATURE_BY_NAME[feature].label;

  function choose(next: FeatureName) {
    setFeature(next);
    const params = new URLSearchParams(searchParams);
    params.set("feature", next);
    replaceLocal(params);
  }

  // Shown only once it matches the chosen feature: a placeholder from the previous one would mislead.
  const points: Point[] =
    data && data.feature === feature
      ? data.points.map((p) => ({ value: p.value, price: p.predicted_price, warned: p.warnings.length > 0 }))
      : [];
  const first = points[0];
  const last = points[points.length - 1];
  const description =
    first && last
      ? `With the other six features held at this scenario's values, moving ${label.toLowerCase()} from ${withUnit(feature, first.value)} to ${withUnit(feature, last.value)} takes the price from ${fmt.price(first.price)} to ${fmt.price(last.price)}. Hollow points are where the model warns that the home is unlike its data.`
      : `How the price moves as ${label.toLowerCase()} runs across the homes in the data.`;

  return (
    <ChartCard
      title={`Price across ${label.toLowerCase()}`}
      description={description}
      controls={
        <div className="flex items-center gap-2">
          <Label htmlFor={`${id}-feature`} className="text-sm font-normal text-muted-foreground">
            Feature
          </Label>
          <NativeSelect id={`${id}-feature`} value={feature} onChange={(event) => choose(event.target.value as FeatureName)}>
            {FEATURES.map((f) => (
              <NativeSelectOption key={f.name} value={f.name}>
                {f.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      }
      table={
        <table className="w-full text-sm">
          <caption className="sr-only">Predicted price at each {label.toLowerCase()}</caption>
          <thead>
            <tr className="text-left">
              <th scope="col" className="py-1 pr-4 font-medium">
                {label}
              </th>
              <th scope="col" className="py-1 pr-4 text-right font-medium">
                Predicted price
              </th>
              <th scope="col" className="py-1 font-medium">
                Model warning
              </th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.value} className="border-t">
                <th scope="row" className="py-1 pr-4 text-left font-normal">
                  {withUnit(feature, p.value)}
                </th>
                <td className="py-1 pr-4 text-right tabular-nums">{fmt.price(p.price)}</td>
                <td className="py-1">{p.warned ? "Unusual for the data" : "None"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      {error ? (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>The sensitivity line didn&apos;t load</AlertTitle>
          <AlertDescription>The model isn&apos;t answering right now. The price above still updates when it does.</AlertDescription>
        </Alert>
      ) : points.length === 0 ? (
        <Skeleton className="h-[280px] w-full" />
      ) : (
        <div className={cn("transition-opacity", isFetching && "opacity-60")}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart accessibilityLayer={false} data={points} margin={{ top: 16, right: 16, bottom: 16, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="value"
                domain={[range.min, range.max]}
                ticks={niceTicks(range.min, range.max, SLIDER_STEPS[feature])}
                tickFormatter={(v: number) => formatFeatureValue(feature, v)}
                tick={{ fontSize: 11 }}
                label={{ value: label, position: "insideBottom", offset: -8, fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <YAxis domain={["auto", "auto"]} tickFormatter={fmt.shortPrice} width={48} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value) => [fmt.price(Number(value)), "Predicted price"]}
                labelFormatter={(value) => withUnit(feature, Number(value))}
              />
              <ReferenceLine
                x={scenario[feature]}
                stroke="var(--muted-foreground)"
                strokeDasharray="4 4"
                label={{ value: "This scenario", position: "top", fontSize: 11, fill: "var(--foreground)" }}
              />
              <Line
                dataKey="price"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={<PointDot />}
                activeDot={{ r: 6 }}
                isAnimationActive={!reducedMotion}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
