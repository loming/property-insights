"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartCard } from "@/components/chart-card";
import { useFormatters } from "@/hooks/use-formatters";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import type { Estimate } from "@/lib/api/estimator";
import { FEATURES, type FeatureName, formatFeatureValue } from "@/lib/features";

import { estimateTitle } from "./estimate-title";

/**
 * Each estimate keeps its colour and letter in the table and both charts, in the order the comparison
 * lists them. The colours are the Okabe-Ito palette's first four (colour-blind safe, checked with the
 * dataviz validator); the letter and the legend mean colour is never the only cue.
 */
export const SERIES = [
  { letter: "A", colour: "var(--chart-1)" },
  { letter: "B", colour: "var(--chart-2)" },
  { letter: "C", colour: "var(--chart-3)" },
  { letter: "D", colour: "var(--chart-4)" },
] as const;

export function SeriesSwatch({ index }: { index: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-3 shrink-0 rounded-sm"
      style={{ background: SERIES[index].colour }}
    />
  );
}

const truncate = (text: string, length = 22) => (text.length > length ? `${text.slice(0, length - 1)}…` : text);

/** E-5: the estimated prices side by side, starting from $0 so the bars compare honestly. */
export function ComparePriceChart({ estimates }: { estimates: Estimate[] }) {
  const fmt = useFormatters();
  const reducedMotion = usePrefersReducedMotion();
  const rows = estimates.map((estimate, i) => ({
    label: `${SERIES[i].letter}  ${truncate(estimateTitle(estimate))}`,
    title: estimateTitle(estimate),
    letter: SERIES[i].letter,
    price: estimate.predicted_price,
    colour: SERIES[i].colour,
  }));
  const sorted = [...rows].sort((a, b) => a.price - b.price);
  const low = sorted[0];
  const high = sorted[sorted.length - 1];
  const description =
    high.price === low.price
      ? `All ${rows.length} estimates come to ${fmt.price(low.price)}.`
      : `From ${fmt.price(low.price)} (${low.letter}, ${low.title}) to ${fmt.price(high.price)} (${high.letter}, ${high.title}): a difference of ${fmt.price(high.price - low.price)}.`;

  return (
    <ChartCard
      title="Estimated prices"
      description={description}
      table={
        <table className="w-full text-sm">
          <caption className="sr-only">Estimated price of each compared estimate</caption>
          <thead>
            <tr className="text-left">
              <th scope="col" className="py-1 pr-4 font-medium">
                Estimate
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Estimated price
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.letter} className="border-t">
                <td className="py-1 pr-4">
                  {row.letter}: {row.title}
                </td>
                <td className="py-1 text-right tabular-nums">{fmt.price(row.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ResponsiveContainer width="100%" height={rows.length * 48 + 36}>
        <BarChart
          accessibilityLayer={false}
          data={rows}
          layout="vertical"
          margin={{ top: 4, right: 56, bottom: 4, left: 8 }}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis type="number" tickFormatter={fmt.shortPrice} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="label" width={170} tick={{ fontSize: 12 }} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            formatter={(value) => [fmt.price(Number(value)), "Estimated price"]}
          />
          <Bar dataKey="price" radius={[0, 4, 4, 0]} maxBarSize={28} isAnimationActive={!reducedMotion}>
            {rows.map((row) => (
              <Cell key={row.letter} fill={row.colour} />
            ))}
            <LabelList
              dataKey="price"
              position="right"
              formatter={(value) => fmt.shortPrice(Number(value))}
              fontSize={11}
              fill="var(--foreground)"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

type FeatureRow = { feature: string; name: FeatureName; unit: string } & Record<string, string | number>;

/**
 * E-5's grouped bars: per feature, where each home sits within the training data. The features have
 * different units, so each is shown as a share of its training range (0% the smallest of the homes
 * the model learned from, 100% the largest) rather than on one shared axis of raw values.
 */
export function CompareFeaturesChart({
  estimates,
  trainingRanges,
  trainingRows,
}: {
  estimates: Estimate[];
  trainingRanges: Record<string, { min: number; max: number }>;
  trainingRows: number;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const share = (name: FeatureName, value: number) => {
    const range = trainingRanges[name];
    return range && range.max > range.min ? ((value - range.min) / (range.max - range.min)) * 100 : 50;
  };
  const rows: FeatureRow[] = FEATURES.map((f) => {
    const row: FeatureRow = { feature: f.label, name: f.name, unit: f.unit };
    estimates.forEach((estimate, i) => {
      row[`share${i}`] = share(f.name, estimate.features[f.name]);
      row[`value${i}`] = estimate.features[f.name];
    });
    return row;
  });
  const describe = (row: FeatureRow, i: number) =>
    `${formatFeatureValue(row.name, Number(row[`value${i}`]))}${row.unit ? ` ${row.unit}` : ""} (${Math.round(Number(row[`share${i}`]))}%)`;

  return (
    <ChartCard
      title="How the homes differ"
      description={`For each feature, where the home sits among the ${trainingRows} homes the model learned from: 0% is the smallest value in that data, 100% the largest. A bar past either end is outside what the model has seen.`}
      table={
        <table className="w-full text-sm">
          <caption className="sr-only">Each feature&apos;s value, and its position in the training range</caption>
          <thead>
            <tr className="text-left">
              <th scope="col" className="py-1 pr-4 font-medium">
                Feature
              </th>
              {estimates.map((estimate, i) => (
                <th key={estimate.id} scope="col" className="py-1 pr-4 text-right font-medium">
                  {SERIES[i].letter}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-t">
                <td className="py-1 pr-4">{row.feature}</td>
                {estimates.map((estimate, i) => (
                  <td key={estimate.id} className="py-1 pr-4 text-right tabular-nums">
                    {describe(row, i)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {estimates.map((estimate, i) => (
          <li key={estimate.id} className="inline-flex items-center gap-1.5">
            <SeriesSwatch index={i} />
            {SERIES[i].letter}: {truncate(estimateTitle(estimate), 30)}
          </li>
        ))}
      </ul>
      <ResponsiveContainer width="100%" height={rows.length * (estimates.length * 10 + 18) + 36}>
        <BarChart
          accessibilityLayer={false}
          data={rows}
          layout="vertical"
          barGap={2}
          margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
        >
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis
            type="number"
            domain={[(min: number) => Math.min(0, Math.floor(min)), (max: number) => Math.max(100, Math.ceil(max))]}
            ticks={[0, 25, 50, 75, 100]}
            tickFormatter={(value) => `${value}%`}
            tick={{ fontSize: 11 }}
          />
          <YAxis type="category" dataKey="feature" width={150} tick={{ fontSize: 12 }} />
          <ReferenceLine x={0} stroke="var(--muted-foreground)" />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            formatter={(_, name, item) => {
              const i = Number(String(item.dataKey).replace("share", ""));
              return [describe(item.payload as FeatureRow, i), name];
            }}
          />
          {estimates.map((estimate, i) => (
            <Bar
              key={estimate.id}
              dataKey={`share${i}`}
              name={`${SERIES[i].letter}: ${truncate(estimateTitle(estimate), 30)}`}
              fill={SERIES[i].colour}
              radius={[0, 4, 4, 0]}
              isAnimationActive={!reducedMotion}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
