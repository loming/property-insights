/**
 * The first focusable element: keyboard users jump past the navigation (WCAG 2.4.1). Its padding is set
 * on focus, because `not-sr-only` resets padding to 0.
 */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only z-50 rounded-md bg-primary text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:px-3 focus:py-2"
    >
      Skip to main content
    </a>
  );
}
