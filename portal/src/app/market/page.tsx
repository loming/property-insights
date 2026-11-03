import type { Metadata } from "next";

import { ComingNext } from "@/components/layout/coming-next";
import { MarketKpis } from "@/features/market/market-kpis";
import { getMarketSummary } from "@/lib/api/market";

export const metadata: Metadata = { title: "Market dashboard" };

/** Loaded on the server through market-api; if it's down, market/error.tsx takes over this app only. */
export default async function MarketDashboardPage() {
  const summary = await getMarketSummary();
  return (
    <div className="space-y-8">
      <ComingNext title="Market dashboard">
        Filters, charts by segment and the price distribution arrive in a later phase.
      </ComingNext>
      <MarketKpis summary={summary} />
    </div>
  );
}
