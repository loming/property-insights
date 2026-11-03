import { Suspense } from "react";

import { NavLinks, type NavItem, SearchAwareNavLinks } from "./nav-links";

/** An app's title and its own sub-navigation, shared by both apps' layouts. */
export function SectionHeader({ title, description, nav }: { title: string; description: string; nav: NavItem[] }) {
  const navProps = { label: `${title} sections`, items: nav, variant: "sub" as const };
  return (
    <div className="mb-6 space-y-3 border-b pb-4">
      <div>
        <p className="font-heading text-xl font-semibold tracking-tight">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {nav.some((item) => item.keepParams) ? (
        // Reading the query string can't happen while prerendering; the plain links stand in until then.
        <Suspense fallback={<NavLinks {...navProps} />}>
          <SearchAwareNavLinks {...navProps} />
        </Suspense>
      ) : (
        <NavLinks {...navProps} />
      )}
    </div>
  );
}
