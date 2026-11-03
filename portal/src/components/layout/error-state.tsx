"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * The shared error panel for error.tsx and catchError boundaries. In production, errors from Server
 * Components arrive with only a digest, which the server logs next to the request ID (doc 03 §5).
 */
export function ErrorState({
  title,
  error,
  retry,
  message = "The service behind this page didn't answer. Everything else keeps working.",
}: {
  title: string;
  error: unknown;
  retry: () => void;
  message?: string;
}) {
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Alert variant="destructive" className="max-w-2xl">
      <AlertTriangle aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {/* retry() re-fetches and re-renders the segment; reset() would only re-render (doc 02, E6). */}
          <Button onClick={() => retry()}>Try again</Button>
          {digest && (
            <span className="text-xs">
              Reference: <code className="font-mono">{digest}</code>
            </span>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
