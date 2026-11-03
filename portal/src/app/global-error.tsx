"use client";

/**
 * Replaces the root layout when it fails, so it brings its own <html> and <body> and no global CSS:
 * inline styles keep it readable and accessible on its own (doc 02, E6).
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: "3rem auto", maxWidth: "36rem", padding: "0 1rem" }}>
        <title>Something went wrong · Property Insights</title>
        <main>
          <h1 style={{ fontSize: "1.5rem" }}>Something went wrong</h1>
          <p>The page couldn&apos;t load. Try again, or come back in a minute.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ padding: "0.5rem 1rem", fontSize: "1rem", minHeight: "2.5rem", cursor: "pointer" }}
          >
            Try again
          </button>
          {digest && (
            <p style={{ fontSize: "0.875rem" }}>
              Reference: <code>{digest}</code>
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
