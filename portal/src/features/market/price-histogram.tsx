"use client";

import { useId, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartCard } from "@/components/chart-card";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useFormatters } from "@/hooks/use-formatters";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import type { DistributionMetric, Histogram } from "@/lib/api/market";
import { formatNumber } from "@/lib/format";

const METRICS: { metric: DistributionMetric; label: string }[] = [
  { metric: "price", label: "Price" },
  { metric: "price_per_sqft", label: "Price per sq ft" },
];

type Band = { lower: number; upper: number; count: number; tick: string; range: string };

/** M-1: how the filtered homes' prices (or prices per sq ft) spread out, as a histogram. */
export function PriceHistogram({ histograms }: { histograms: Histogram[] }) {
  const fmt = useFormatters();
  const reducedMotion = usePrefersReducedMotion();
  const [metric, setMetric] = useState<DistributionMetric>("price");
  const id = useId();
  const histogram = histograms.find((h) => h.metric === metric) ?? histograms[0]!;
  const perSqft = histogram.metric === "price_per_sqft";
  const money = (value: number) => (perSqft ? `$${formatNumber(value, 0)}` : fmt.price(value));
  const bands: Band[] = histogram.bins.map((bin) => ({
    ...bin,
    tick: perSqft ? `$${formatNumber(bin.lower, 0)}` : fmt.shortPrice(bin.lower),
    range: `${money(bin.lower)}–${money(bin.upper)}`,
  }));
  const label = perSqft ? "price per sq ft" : "price";
  const mode = bands.reduce<Band | undefined>((best, band) => (!best || band.count > best.count ? band : best), undefined);
  const description =
    histogram.count === 0 || !mode
      ? "No homes match the filters."
      : `${histogram.count} ${histogram.count === 1 ? "home" : "homes"} in ${bands.length} equal bands. The most common ${label} is ${mode.range} (${mode.count} ${mode.count === 1 ? "home" : "homes"}).`;

  return (
    <ChartCard
      title={`How ${label}s spread`}
      description={description}
      controls={
        <div className="flex items-center gap-2">
          <Label htmlFor={`${id}-metric`} className="text-sm font-normal text-muted-foreground">
            Measure
          </Label>
          <NativeSelect
            id={`${id}-metric`}
            value={histogram.metric}
            onChange={(event) => setMetric(event.target.value as DistributionMetric)}
          >
            {METRICS.map((m) => (
              <NativeSelectOption key={m.metric} value={m.metric}>
                {m.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      }
      table={
        <table className="w-full text-sm">
          <caption className="sr-only">Homes per {label} band</caption>
          <thead>
            <tr className="text-left">
              <th scope="col" className="py-1 pr-4 font-medium">
                {perSqft ? "Price per sq ft" : "Price"}
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Homes
              </th>
            </tr>
          </thead>
          <tbody>
            {bands.map((band) => (
              <tr key={band.lower} className="border-t">
                <th scope="row" className="py-1 pr-4 text-left font-normal">
                  {band.range}
                </th>
                <td className="py-1 text-right tabular-nums">{band.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      {histogram.count === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No homes to chart.</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            accessibilityLayer={false}
            data={bands}
            barCategoryGap={2}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="tick" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} width={28} tick={{ fontSize: 11 }} />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              formatter={(value) => [value, "Homes"]}
              labelFormatter={(_, payload) => (payload?.[0]?.payload as Band | undefined)?.range ?? ""}
            />
            <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} isAnimationActive={!reducedMotion} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
