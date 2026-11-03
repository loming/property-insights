"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";

import { ChartCard } from "@/components/chart-card";
import { useFormatters } from "@/hooks/use-formatters";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { FEATURES } from "@/lib/features";

/**
 * The Ridge set only: how each feature moves the price away from the average home. Under the brief set's
 * plain linear regression these bars mislead (a smaller home's size *adds* value), so it isn't shown
 * there (doc 02, B11).
 */
export function ContributionChart({
  price,
  contributions,
}: {
  price: number;
  contributions: { baseline: number; by_feature: Record<string, number> };
}) {
  const fmt = useFormatters();
  const reducedMotion = usePrefersReducedMotion();
  const rows = FEATURES.map((f) => ({ feature: f.label, value: contributions.by_feature[f.name] ?? 0 })).sort(
    (a, b) => Math.abs(b.value) - Math.abs(a.value),
  );

  return (
    <ChartCard
      title="What moves this estimate"
      description={`Starting from the average home (${fmt.price(contributions.baseline)}), each bar is how much this home's value for one feature moves the price, with the others held constant. Together they come to ${fmt.price(price)}.`}
      table={
        <table className="w-full text-sm">
          <caption className="sr-only">Each feature&apos;s contribution to the estimate</caption>
          <thead>
            <tr className="text-left">
              <th scope="col" className="py-1 pr-4 font-medium">
                Feature
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Effect on price
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="py-1 pr-4">Average home</td>
              <td className="py-1 text-right tabular-nums">{fmt.price(contributions.baseline)}</td>
            </tr>
            {rows.map((row) => (
              <tr key={row.feature} className="border-t">
                <td className="py-1 pr-4">{row.feature}</td>
                <td className="py-1 text-right tabular-nums">{fmt.signedPrice(row.value)}</td>
              </tr>
            ))}
            <tr className="border-t font-medium">
              <td className="py-1 pr-4">This estimate</td>
              <td className="py-1 text-right tabular-nums">{fmt.price(price)}</td>
            </tr>
          </tbody>
        </table>
      }
    >
      <ResponsiveContainer width="100%" height={rows.length * 34 + 30}>
        <BarChart
          accessibilityLayer={false}
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 56, bottom: 4, left: 8 }}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis type="number" tickFormatter={fmt.signedPrice} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="feature" width={150} tick={{ fontSize: 12 }} />
          <ReferenceLine x={0} stroke="var(--foreground)" />
          <Bar dataKey="value" isAnimationActive={!reducedMotion}>
            {rows.map((row) => (
              <Cell key={row.feature} fill={row.value >= 0 ? "var(--chart-3)" : "#d55e00"} />
            ))}
            {/* The sign is written out too: colour is never the only cue (WCAG 1.4.1). */}
            <LabelList
              dataKey="value"
              position="right"
              formatter={(v) => fmt.signedPrice(Number(v))}
              fontSize={11}
              fill="var(--foreground)"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
