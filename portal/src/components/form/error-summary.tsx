export type SummaryError = { id: string; label: string; message: string };

/**
 * Every problem in one place after a failed submit, each linking to its field (WCAG 3.3.1). role="alert"
 * announces it; the form moves focus to the first invalid field itself.
 */
export function ErrorSummary({ errors }: { errors: SummaryError[] }) {
  if (errors.length === 0) {
    return null;
  }
  return (
    <div role="alert" className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm">
      <p className="font-medium text-destructive">
        {errors.length === 1 ? "One field needs attention:" : `${errors.length} fields need attention:`}
      </p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {errors.map((error) => (
          <li key={error.id}>
            <a href={`#${error.id}`} className="underline underline-offset-4 hover:no-underline">
              {error.label}: {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
