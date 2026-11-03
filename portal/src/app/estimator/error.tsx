"use client";

import { ErrorState } from "@/components/layout/error-state";

/** App 1's own boundary: the header, navigation and the Market app keep working (P-0). */
export default function EstimatorError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorState title="The estimator isn't available right now" error={error} retry={retry} />;
}
