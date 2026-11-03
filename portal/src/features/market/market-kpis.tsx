import { SearchX } from "lucide-react";
import Link from "next/link";

import { StatTile } from "@/components/stat-tile";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { MarketSummary } from "@/lib/api/market";
import { formatNumber, formatPrice } from "@/lib/format";

/** Headline figures for the (filtered) market; `total` is the whole market's count, when it differs. */
export function MarketKpis({ summary, total, clearHref }: { summary: MarketSummary; total?: number; clearHref: string }) {
  if (summary.count === 0 || !summary.price) {
    return (
      <Alert>
        <SearchX aria-hidden="true" />
        <AlertTitle>No homes match these filters</AlertTitle>
        <AlertDescription>
          Widen a range or <Link href={clearHref}>clear the filters</Link> to see the market again.
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <section aria-labelledby="kpi-heading" className="space-y-3">
      <h2 id="kpi-heading" className="font-heading text-lg font-semibold">
        Market at a glance
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Homes"
          value={formatNumber(summary.count)}
          hint={total !== undefined && total !== summary.count ? `of ${formatNumber(total)} in the data` : "Every home in the data"}
        />
        <StatTile
          label="Median price"
          value={formatPrice(summary.price.median)}
          hint={`Middle half: ${formatPrice(summary.price.q1)} – ${formatPrice(summary.price.q3)}`}
        />
        <StatTile
          label="Mean price"
          value={formatPrice(summary.price.mean)}
          hint={`From ${formatPrice(summary.price.min)} to ${formatPrice(summary.price.max)}`}
        />
        <StatTile
          label="Mean price per sq ft"
          value={summary.mean_price_per_sqft === null ? "–" : formatPrice(summary.mean_price_per_sqft)}
          hint={summary.mean_square_footage === null ? undefined : `Mean living area ${formatNumber(Math.round(summary.mean_square_footage))} sq ft`}
        />
      </div>
    </section>
  );
}
