"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { PAGE_NAVIGATION } from "@/lib/transitions";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
  /** Query parameters the link carries over from the current page, such as the market filters. */
  keepParams?: readonly string[];
};

function hrefFor(item: NavItem, search: URLSearchParams | undefined): string {
  if (!search || !item.keepParams) {
    return item.href;
  }
  const params = new URLSearchParams();
  for (const [name, value] of search) {
    if (item.keepParams.includes(name)) {
      params.append(name, value);
    }
  }
  return params.size > 0 ? `${item.href}?${params}` : item.href;
}

/** A labelled nav landmark; the current page is marked with aria-current, not only with colour. */
export function NavLinks({
  label,
  items,
  variant = "primary",
  search,
}: {
  label: string;
  items: NavItem[];
  variant?: "primary" | "sub";
  search?: URLSearchParams;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap gap-1">
        {items.map((item) => {
          const current = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={hrefFor(item, search)}
                transitionTypes={[PAGE_NAVIGATION]}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-8 items-center rounded-md px-3 text-sm font-medium transition-colors",
                  "hover:bg-accent hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none",
                  current
                    ? variant === "primary"
                      ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                      : "bg-accent text-accent-foreground underline decoration-2 underline-offset-8"
                    : "text-muted-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** NavLinks that read the current query string, for items with keepParams. Render it inside Suspense. */
export function SearchAwareNavLinks(props: Omit<React.ComponentProps<typeof NavLinks>, "search">) {
  const search = useSearchParams();
  return <NavLinks {...props} search={new URLSearchParams(search)} />;
}
