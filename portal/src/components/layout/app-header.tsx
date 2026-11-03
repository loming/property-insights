import Link from "next/link";
import { Suspense } from "react";

import { NavLinks } from "./nav-links";
import { VariantBadge } from "./variant-badge";

const APPS = [
  { href: "/", label: "Overview", exact: true },
  { href: "/estimator", label: "Estimator" },
  { href: "/market", label: "Market" },
];

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="font-heading text-base font-semibold tracking-tight">
          Property Insights
        </Link>
        <NavLinks label="Applications" items={APPS} />
        <div className="ml-auto">
          {/* Reads runtime env after connection(); never part of a prerendered page (doc 02, E15). */}
          <Suspense fallback={null}>
            <VariantBadge />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
