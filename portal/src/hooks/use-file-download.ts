"use client";

import { useCallback, useState } from "react";

import { isProblem } from "@/lib/api/problem";

/** The file name a Content-Disposition header gives, e.g. attachment; filename="report.pdf". */
export function filenameFrom(disposition: string | null, fallback: string): string {
  const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  return match ? decodeURIComponent(match[1]!) : fallback;
}

/**
 * Downloads a file with fetch, so a failure shows as a message on the page instead of navigating to an
 * error response. The browser then saves the blob under the server's file name.
 */
export function useFileDownload() {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = useCallback(async (url: string, fallbackName: string) => {
    setPending(url);
    setError(null);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        throw new Error(isProblem(body) && body.detail ? body.detail : `The download failed (${response.status}).`);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filenameFrom(response.headers.get("Content-Disposition"), fallbackName);
      document.body.append(link);
      link.click();
      link.remove();
      // Revoked a moment later: some browsers start reading the blob only after the click returns.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
    } catch (cause) {
      setError(cause instanceof Error && cause.message !== "Failed to fetch" ? cause.message : "The download failed. Check your connection and try again.");
    } finally {
      setPending(null);
    }
  }, []);

  return { download, pending, error };
}
