"use client";

import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";

import { ChartCard } from "@/components/chart-card";
import { useFormatters } from "@/hooks/use-formatters";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import type { PropertyRow } from "@/lib/api/market";
import { formatNumber } from "@/lib/format";

import { pearson } from "./stats";

/**
 * Each bedroom count keeps one colour and one shape, whatever the filters (they follow the value, not
 * its rank), so a group is never told apart by colour alone. Okabe-Ito colours, as in the other charts.
 */
const MARKS = [
  { colour: "var(--chart-1)", shape: "circle" },
  { colour: "var(--chart-2)", shape: "square" },
  { colour: "var(--chart-3)", shape: "triangle" },
  { colour: "var(--chart-4)", shape: "diamond" },
  { colour: "var(--chart-5)", shape: "cross" },
] as const;

type Mark = (typeof MARKS)[number];

function markFor(bedrooms: number, choices: number[]): Mark {
  const index = choices.indexOf(bedrooms);
  return MARKS[(index < 0 ? bedrooms : index) % MARKS.length]!;
}

/** The legend's copy of a mark. */
function MarkSymbol({ mark }: { mark: Mark }) {
  const props = { fill: mark.colour, stroke: "var(--background)", strokeWidth: 1 };
  const shapes: Record<Mark["shape"], React.ReactNode> = {
    circle: <circle cx="6" cy="6" r="5" {...props} />,
    square: <rect x="1.5" y="1.5" width="9" height="9" {...props} />,
    triangle: <path d="M6 0.5 11.5 11H0.5Z" {...props} />,
    diamond: <path d="M6 0 12 6 6 12 0 6Z" {...props} />,
    cross: <path d="M4 0h4v4h4v4H8v4H4V8H0V4h4Z" {...props} />,
  };
  return (
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" className="shrink-0">
      {shapes[mark.shape]}
    </svg>
  );
}

function HomeTooltip({ active, payload }: { active?: boolean; payload?: { payload: PropertyRow }[] }) {
  const fmt = useFormatters();
  const home = payload?.[0]?.payload;
  if (!active || !home) {
    return null;
  }
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="font-medium">Home #{home.id}</p>
      <p>
        {fmt.price(home.price)} · {fmt.price(home.price_per_sqft)} per sq ft
      </p>
      <p>
        {formatNumber(home.square_footage)} sq ft · {home.bedrooms} bed · {formatNumber(home.bathrooms)} bath · built{" "}
        {home.year_built}
      </p>
    </div>
  );
}

/** M-1: every filtered home's price against its living area, one mark per home. */
export function PriceSizeScatter({ homes, bedroomChoices }: { homes: PropertyRow[]; bedroomChoices: number[] }) {
  const fmt = useFormatters();
  const reducedMotion = usePrefersReducedMotion();
  const groups = [...new Set(homes.map((h) => h.bedrooms))]
    .sort((a, b) => a - b)
    .map((bedrooms) => ({ bedrooms, mark: markFor(bedrooms, bedroomChoices), homes: homes.filter((h) => h.bedrooms === bedrooms) }));
  const r = pearson(
    homes.map((h) => h.square_footage),
    homes.map((h) => h.price),
  );
  const description =
    homes.length === 0
      ? "No homes match the filters."
      : r === null
        ? `${homes.length} ${homes.length === 1 ? "home" : "homes"}: too few to show a trend.`
        : `${homes.length} homes. Price ${r >= 0 ? "rises" : "falls"} with living area: the correlation is ${formatNumber(r, 2)} (1 would be a perfect straight line). Shapes and colours mark the number of bedrooms.`;
  const byArea = [...homes].sort((a, b) => a.square_footage - b.square_footage || a.id - b.id);

  return (
    <ChartCard
      title="Price against living area"
      description={description}
      table={
        <table className="w-full text-sm">
          <caption className="sr-only">Each home&apos;s living area, bedrooms and price, smallest first</caption>
          <thead>
            <tr className="text-left">
              <th scope="col" className="py-1 pr-4 font-medium">
                Home
              </th>
              <th scope="col" className="py-1 pr-4 text-right font-medium">
                Living area
              </th>
              <th scope="col" className="py-1 pr-4 text-right font-medium">
                Bedrooms
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Price
              </th>
            </tr>
          </thead>
          <tbody>
            {byArea.map((home) => (
              <tr key={home.id} className="border-t">
                <th scope="row" className="py-1 pr-4 text-left font-normal">
                  #{home.id}
                </th>
                <td className="py-1 pr-4 text-right tabular-nums">{formatNumber(home.square_footage)} sq ft</td>
                <td className="py-1 pr-4 text-right tabular-nums">{home.bedrooms}</td>
                <td className="py-1 text-right tabular-nums">{fmt.price(home.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      {homes.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No homes to chart.</p>
      ) : (
        <>
          <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {groups.map((group) => (
              <li key={group.bedrooms} className="inline-flex items-center gap-1.5">
                <MarkSymbol mark={group.mark} />
                {group.bedrooms} bed ({group.homes.length})
              </li>
            ))}
          </ul>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart accessibilityLayer={false} margin={{ top: 8, right: 16, bottom: 16, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="square_footage"
                name="Living area"
                // Padded to whole hundreds, so the ticks fall on round sizes.
                domain={[(min: number) => Math.floor((min - 50) / 100) * 100, (max: number) => Math.ceil((max + 50) / 100) * 100]}
                tickFormatter={(value: number) => formatNumber(Math.round(value))}
                tick={{ fontSize: 11 }}
                label={{ value: "Living area (sq ft)", position: "insideBottom", offset: -8, fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                type="number"
                dataKey="price"
                name="Price"
                domain={["auto", "auto"]}
                tickFormatter={fmt.shortPrice}
                width={48}
                tick={{ fontSize: 11 }}
              />
              <ZAxis range={[80, 80]} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<HomeTooltip />} />
              {groups.map((group) => (
                <Scatter
                  key={group.bedrooms}
                  name={`${group.bedrooms} bed`}
                  data={group.homes}
                  fill={group.mark.colour}
                  shape={group.mark.shape}
                  stroke="var(--background)"
                  strokeWidth={1}
                  isAnimationActive={!reducedMotion}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </>
      )}
    </ChartCard>
  );
}
