"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

/**
 * State kept in the URL (filters, sort, the chosen baseline), so a link shares it and a reload keeps it.
 *
 * - `replace` asks the server for the page again inside a transition: the current content stays up
 *   (callers dim it while `isPending`) until the new content is ready. `optimistic` runs inside that
 *   transition, for a useOptimistic update.
 * - `replaceLocal` only rewrites the address, for state the browser already has everything for, such as
 *   the table's sort. Next keeps useSearchParams in step with it.
 */
export function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const href = useCallback(
    (params: URLSearchParams) => {
      const query = params.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [pathname],
  );

  const replace = useCallback(
    (params: URLSearchParams, optimistic?: () => void) => {
      startTransition(() => {
        optimistic?.();
        router.replace(href(params), { scroll: false });
      });
    },
    [href, router],
  );

  const replaceLocal = useCallback(
    (params: URLSearchParams) => {
      // null, as Next documents: passing its own history state back makes it skip the useSearchParams sync.
      window.history.replaceState(null, "", href(params));
    },
    [href],
  );

  return { searchParams, isPending, replace, replaceLocal };
}
