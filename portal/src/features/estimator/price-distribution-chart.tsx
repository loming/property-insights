"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartCard } from "@/components/chart-card";
import { useFormatters } from "@/hooks/use-formatters";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

export type PriceDistribution = { bin_edges: number[]; counts: number[] };

/** E-3's chart: where the estimate sits among the prices of the 50 homes the model learned from. */
export function PriceDistributionChart({ price, distribution }: { price: number; distribution: PriceDistribution }) {
  const fmt = useFormatters();
  const reducedMotion = usePrefersReducedMotion();
  const { bin_edges: edges, counts } = distribution;
  const last = counts.length - 1;
  const bands = counts.map((count, i) => ({
    lower: edges[i],
    upper: edges[i + 1],
    label: fmt.shortPrice(edges[i]),
    count,
    // The last band includes its top edge.
    mine: price >= edges[i] && (price < edges[i + 1] || (i === last && price <= edges[i + 1])),
  }));
  const mine = bands.find((band) => band.mine);
  const total = counts.reduce((sum, count) => sum + count, 0);
  const description = mine
    ? `This estimate, ${fmt.price(price)}, falls in the ${fmt.price(mine.lower)}–${fmt.price(mine.upper)} band (highlighted), where ${mine.count} of the ${total} homes sold.`
    : `This estimate, ${fmt.price(price)}, is ${price < edges[0] ? "below" : "above"} every price in the data (${fmt.price(edges[0])}–${fmt.price(edges[edges.length - 1])}).`;

  return (
    <ChartCard
      title="Where this estimate sits among the homes sold"
      description={description}
      table={
        <table className="w-full text-sm">
          <caption className="sr-only">Homes sold per price band</caption>
          <thead>
            <tr className="text-left">
              <th scope="col" className="py-1 pr-4 font-medium">
                Price band
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Homes sold
              </th>
            </tr>
          </thead>
          <tbody>
            {bands.map((band) => (
              <tr key={band.lower} className="border-t">
                <td className="py-1 pr-4">
                  {fmt.price(band.lower)}–{fmt.price(band.upper)}
                  {band.mine && <strong> (this estimate)</strong>}
                </td>
                <td className="py-1 text-right tabular-nums">{band.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ResponsiveContainer width="100%" height={240}>
        <BarChart accessibilityLayer={false} data={bands} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} width={28} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value) => [value, "Homes sold"]}
            labelFormatter={(_, payload) => {
              const band = payload?.[0]?.payload as (typeof bands)[number] | undefined;
              return band ? `${fmt.price(band.lower)}–${fmt.price(band.upper)}` : "";
            }}
          />
          <Bar dataKey="count" isAnimationActive={!reducedMotion}>
            {bands.map((band) => (
              <Cell
                key={band.lower}
                fill={band.mine ? "var(--chart-2)" : "var(--chart-1)"}
                stroke={band.mine ? "var(--foreground)" : undefined}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
