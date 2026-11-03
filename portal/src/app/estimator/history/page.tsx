import type { Metadata } from "next";

import { ComingNext } from "@/components/layout/coming-next";

export const metadata: Metadata = { title: "Estimate history" };

export default function HistoryPage() {
  return (
    <ComingNext title="Estimate history">
      Your previous estimates, newest first, with delete and &ldquo;add to comparison&rdquo;, arrive in the next phase.
    </ComingNext>
  );
}
