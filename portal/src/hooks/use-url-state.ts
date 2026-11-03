"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { addTransitionType, useCallback, useTransition } from "react";

import { URL_STATE_TRANSITION } from "@/lib/transitions";

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
        addTransitionType(URL_STATE_TRANSITION);
        optimistic?.();
        router.replace(href(params), { scroll: false });
      });
    },
    [href, router],
  );

  const replaceLocal = useCallback(
    (params: URLSearchParams) => {
      window.history.replaceState(window.history.state, "", href(params));
    },
    [href],
  );

  return { searchParams, isPending, replace, replaceLocal };
}
