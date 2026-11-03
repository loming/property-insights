import type { Metadata } from "next";

import { ComingNext } from "@/components/layout/coming-next";

export const metadata: Metadata = { title: "Compare estimates" };

export default function ComparePage() {
  return (
    <ComingNext title="Compare estimates">
      Two to four saved estimates side by side, with the differences highlighted, arrive in the next phase.
    </ComingNext>
  );
}
