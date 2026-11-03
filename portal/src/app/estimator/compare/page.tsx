import { Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { parseCompareIds } from "@/features/estimator/compare-ids";
import { CompareFromTray, PruneCompareTray } from "@/features/estimator/compare-tray";
import { ComparisonView } from "@/features/estimator/comparison-view";
import { compareEstimates, getModelInfo } from "@/lib/api/estimator";
import { ApiError } from "@/lib/api/problem";
import { MAX_COMPARE, MIN_COMPARE } from "@/stores/compare-tray";

export const metadata: Metadata = { title: "Compare estimates" };

/**
 * E-5: two to four saved estimates side by side, chosen in the tray and carried in the URL
 * (?ids=a,b), so a comparison can be bookmarked or shared. Estimates deleted since are reported and
 * taken out of the tray.
 */
export default async function ComparePage({ searchParams }: PageProps<"/estimator/compare">) {
  const ids = parseCompareIds((await searchParams).ids);

  if (ids.length < MIN_COMPARE) {
    return (
      <div className="max-w-2xl space-y-4">
        <h1 className="font-heading text-2xl font-semibold">Compare estimates</h1>
        <p className="text-muted-foreground">
          Pick {MIN_COMPARE} to {MAX_COMPARE} estimates with their Compare button, in the history or on an
          estimate, then choose Compare in the tray at the bottom of the page.
        </p>
        <div className="flex flex-wrap gap-3">
          <CompareFromTray />
          <Button asChild variant="outline">
            <Link href="/estimator/history">Go to the history</Link>
          </Button>
        </div>
      </div>
    );
  }

  const [comparison, model] = await Promise.all([
    compareEstimates(ids).catch((error: unknown) => {
      // None of them exist any more.
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }),
    getModelInfo(),
  ]);
  const estimates = comparison?.estimates ?? [];
  const missing = comparison?.missing_ids ?? ids;
  const trainingRanges = Object.fromEntries(model.features.map((f) => [f.name, { min: f.training_min, max: f.training_max }]));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold">Compare estimates</h1>
        {estimates.length >= MIN_COMPARE && (
          <p className="text-sm text-muted-foreground">
            {estimates.length} estimates side by side. Where they differ, the highest and lowest values are marked.
          </p>
        )}
      </div>

      {missing.length > 0 && (
        <>
          <PruneCompareTray missingIds={missing} />
          <Alert className="max-w-2xl">
            <Info aria-hidden="true" />
            <AlertTitle>
              {missing.length === 1 ? "One estimate no longer exists" : `${missing.length} estimates no longer exist`}
            </AlertTitle>
            <AlertDescription>
              {missing.length === 1 ? "It was" : "They were"} deleted from the history, so{" "}
              {missing.length === 1 ? "it's" : "they're"} left out here and taken out of your tray.
            </AlertDescription>
          </Alert>
        </>
      )}

      {comparison && estimates.length >= MIN_COMPARE ? (
        <ComparisonView comparison={comparison} trainingRanges={trainingRanges} trainingRows={model.training_rows} />
      ) : (
        <div className="max-w-2xl space-y-3">
          <p>Fewer than two of these estimates are left, so there&apos;s nothing to compare.</p>
          <Button asChild variant="outline">
            <Link href="/estimator/history">Pick others in the history</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
