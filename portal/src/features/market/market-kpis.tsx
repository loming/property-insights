import { StatTile } from "@/components/stat-tile";
import type { MarketSummary } from "@/lib/api/market";
import { formatNumber, formatPrice } from "@/lib/format";

/** Headline figures for the (filtered) market. */
export function MarketKpis({ summary }: { summary: MarketSummary }) {
  if (summary.count === 0 || !summary.price) {
    return <p className="text-muted-foreground">No homes match these filters.</p>;
  }
  return (
    <section aria-labelledby="kpi-heading" className="space-y-3">
      <h2 id="kpi-heading" className="font-heading text-lg font-semibold">
        Market at a glance
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Homes" value={formatNumber(summary.count)} />
        <StatTile
          label="Median price"
          value={formatPrice(summary.price.median)}
          hint={`Middle half: ${formatPrice(summary.price.q1)} – ${formatPrice(summary.price.q3)}`}
        />
        <StatTile label="Mean price" value={formatPrice(summary.price.mean)} />
        <StatTile
          label="Mean price per sq ft"
          value={summary.mean_price_per_sqft === null ? "–" : formatPrice(summary.mean_price_per_sqft)}
        />
      </div>
    </section>
  );
}
