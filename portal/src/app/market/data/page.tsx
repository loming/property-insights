import type { Metadata } from "next";

import { ComingNext } from "@/components/layout/coming-next";

export const metadata: Metadata = { title: "Market data" };

export default function MarketDataPage() {
  return (
    <ComingNext title="Market data">
      A sortable, filterable table of the homes, with CSV and PDF export, arrives in a later phase.
    </ComingNext>
  );
}
