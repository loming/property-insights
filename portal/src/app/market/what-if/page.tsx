import type { Metadata } from "next";

import { ComingNext } from "@/components/layout/coming-next";

export const metadata: Metadata = { title: "What-if analysis" };

export default function WhatIfPage() {
  return (
    <ComingNext title="What-if analysis">
      Pick a baseline home, change its features and see how the model&apos;s price moves. Arrives in a later phase.
    </ComingNext>
  );
}
