import { ChevronLeft, Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { DateTime } from "@/components/date-time";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EstimateResult } from "@/features/estimator/estimate-result";
import { getServerEnv } from "@/lib/api/env";
import { getEstimate, getModelInfo } from "@/lib/api/estimator";
import { ApiError } from "@/lib/api/problem";

export const metadata: Metadata = { title: "Saved estimate" };

/** One saved estimate, shown as it was on the form. An unknown or deleted id is a 404 (not-found.tsx). */
export default async function SavedEstimatePage({ params }: PageProps<"/estimator/history/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) {
    notFound();
  }
  const [estimate, model] = await Promise.all([
    getEstimate(id).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }),
    getModelInfo(),
  ]);
  if (!estimate) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href="/estimator/history"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          All estimates
        </Link>
        <h1 className="font-heading text-2xl font-semibold">Saved estimate</h1>
        <p className="text-sm text-muted-foreground">
          Saved <DateTime iso={estimate.created_at} />
        </p>
      </div>

      {estimate.model_version !== model.model_version && (
        <Alert className="max-w-2xl">
          <Info aria-hidden="true" />
          <AlertDescription>
            This estimate came from an earlier model ({estimate.model_version}). The price bands below are from the
            current one ({model.model_version}).
          </AlertDescription>
        </Alert>
      )}

      <EstimateResult
        estimate={estimate}
        distribution={model.price_distribution}
        showContributions={getServerEnv().APP_VARIANT === "ridge"}
      />
    </div>
  );
}
