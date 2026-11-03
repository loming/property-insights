"use client";

import { useId, useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartCard } from "@/components/chart-card";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useFormatters } from "@/hooks/use-formatters";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useUrlState } from "@/hooks/use-url-state";
import type { SegmentBy, SegmentRow, Segments } from "@/lib/api/market";

import { SEGMENTATIONS } from "./segments";

function SegmentTooltip({ active, payload }: { active?: boolean; payload?: { payload: SegmentRow }[] }) {
  const fmt = useFormatters();
  const row = payload?.[0]?.payload;
  if (!active || !row) {
    return null;
  }
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-medium">{row.segment}</p>
      <p>Median {fmt.price(row.median_price)}</p>
      <p>Mean {fmt.price(row.mean_price)}</p>
      <p>
        {row.count} {row.count === 1 ? "home" : "homes"} · {fmt.price(row.mean_price_per_sqft)} per sq ft
      </p>
    </div>
  );
}

/**
 * M-1: median price per segment, split by bedrooms, bathrooms, decade, school rating or distance. All
 * five splits arrive with the page, so switching is instant; the choice is kept in the URL (?segment=).
 */
export function SegmentPriceChart({ splits, initial }: { splits: Segments[]; initial: SegmentBy }) {
  const fmt = useFormatters();
  const reducedMotion = usePrefersReducedMotion();
  const { searchParams, replaceLocal } = useUrlState();
  const [by, setBy] = useState<SegmentBy>(initial);
  const id = useId();
  const split = splits.find((s) => s.by === by) ?? splits[0]!;
  const label = SEGMENTATIONS.find((s) => s.by === split.by)?.label ?? split.by;
  const rows = split.segments;

  function choose(next: SegmentBy) {
    setBy(next);
    const params = new URLSearchParams(searchParams);
    if (next === "bedrooms") {
      params.delete("segment");
    } else {
      params.set("segment", next);
    }
    replaceLocal(params);
  }

  const sorted = [...rows].sort((a, b) => a.median_price - b.median_price);
  const low = sorted[0];
  const high = sorted[sorted.length - 1];
  const homes = (count: number) => `${count} ${count === 1 ? "home" : "homes"}`;
  const description =
    !low || !high
      ? "No homes match the filters."
      : rows.length === 1
        ? `Every matching home is in one group: ${low.segment}, median ${fmt.price(low.median_price)} (${homes(low.count)}).`
        : `The median price runs from ${fmt.price(low.median_price)} (${low.segment}, ${homes(low.count)}) to ${fmt.price(high.median_price)} (${high.segment}, ${homes(high.count)}).`;

  return (
    <ChartCard
      title={`Median price by ${label.toLowerCase()}`}
      description={description}
      controls={
        <div className="flex items-center gap-2">
          <Label htmlFor={`${id}-by`} className="text-sm font-normal text-muted-foreground">
            Split by
          </Label>
          <NativeSelect id={`${id}-by`} value={split.by} onChange={(event) => choose(event.target.value as SegmentBy)}>
            {SEGMENTATIONS.map((s) => (
              <NativeSelectOption key={s.by} value={s.by}>
                {s.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      }
      table={
        <table className="w-full text-sm">
          <caption className="sr-only">Price by {label.toLowerCase()}</caption>
          <thead>
            <tr className="text-left">
              <th scope="col" className="py-1 pr-4 font-medium">
                {label}
              </th>
              <th scope="col" className="py-1 pr-4 text-right font-medium">
                Homes
              </th>
              <th scope="col" className="py-1 pr-4 text-right font-medium">
                Median price
              </th>
              <th scope="col" className="py-1 pr-4 text-right font-medium">
                Mean price
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Per sq ft
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.segment} className="border-t">
                <th scope="row" className="py-1 pr-4 text-left font-normal">
                  {row.segment}
                </th>
                <td className="py-1 pr-4 text-right tabular-nums">{row.count}</td>
                <td className="py-1 pr-4 text-right tabular-nums">{fmt.price(row.median_price)}</td>
                <td className="py-1 pr-4 text-right tabular-nums">{fmt.price(row.mean_price)}</td>
                <td className="py-1 text-right tabular-nums">{fmt.price(row.mean_price_per_sqft)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      {rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No homes to chart.</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart accessibilityLayer={false} data={rows} margin={{ top: 20, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="segment" tick={{ fontSize: 11 }} interval={0} />
            <YAxis
              // Up to the next $100k, so the ticks fall on round prices.
              domain={[0, (max: number) => Math.ceil(max / 100_000) * 100_000]}
              tickCount={5}
              tickFormatter={fmt.shortPrice}
              width={48}
              tick={{ fontSize: 11 }}
            />
            <Tooltip cursor={{ fill: "var(--muted)" }} content={<SegmentTooltip />} />
            <Bar
              dataKey="median_price"
              fill="var(--chart-1)"
              radius={[4, 4, 0, 0]}
              maxBarSize={56}
              isAnimationActive={!reducedMotion}
            >
              <LabelList
                dataKey="median_price"
                position="top"
                formatter={(value) => fmt.shortPrice(Number(value))}
                fontSize={11}
                fill="var(--foreground)"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
