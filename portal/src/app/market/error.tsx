"use client";

import { ErrorState } from "@/components/layout/error-state";

/** App 2's own boundary: the header, navigation and the Estimator app keep working (P-0). */
export default function MarketError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorState title="The market analysis isn't available right now" error={error} retry={retry} />;
}
