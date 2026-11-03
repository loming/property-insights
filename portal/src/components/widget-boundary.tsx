"use client";

import { catchError, type ErrorInfo } from "next/error";

import { ErrorState } from "@/components/layout/error-state";

function WidgetError({ title }: { title: string }, { error, retry }: ErrorInfo) {
  return (
    <ErrorState
      title={`${title} didn't load`}
      message="This part of the page couldn't get its data. The rest of the page keeps working."
      error={error}
      retry={retry}
    />
  );
}

/**
 * An error boundary around one streamed widget, so one failure doesn't blank the page (TR-2c).
 * retry() fetches that widget's data again on the server.
 */
export const WidgetBoundary = catchError(WidgetError);
