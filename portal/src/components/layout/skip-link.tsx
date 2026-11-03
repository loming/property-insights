/** The first focusable element: keyboard users jump past the navigation (WCAG 2.4.1). */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
    >
      Skip to main content
    </a>
  );
}
