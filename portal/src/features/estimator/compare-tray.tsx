"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { MAX_COMPARE, MIN_COMPARE } from "@/stores/compare-tray";

import { compareHref } from "./compare-ids";
import { useCompareTray, useCompareTrayHydrated } from "./hooks/use-compare-tray";

/** Takes estimates that no longer exist out of the tray, once it has been read. Renders nothing. */
export function PruneCompareTray({ missingIds }: { missingIds: string[] }) {
  const hydrated = useCompareTrayHydrated();
  const prune = useCompareTray((state) => state.prune);
  useEffect(() => {
    if (hydrated) {
      prune(missingIds);
    }
  }, [hydrated, prune, missingIds]);
  return null;
}

/** On the compare page without ids: a shortcut to what's already in the tray. */
export function CompareFromTray() {
  const hydrated = useCompareTrayHydrated();
  const items = useCompareTray((state) => state.items);
  if (!hydrated || items.length < MIN_COMPARE) {
    return null;
  }
  return (
    <Button asChild>
      <Link href={compareHref(items.map((item) => item.id))}>Compare the {items.length} in your tray</Link>
    </Button>
  );
}

/** E-5's tray: the estimates picked for comparison, on every estimator page once there is one. */
export function CompareTray() {
  const hydrated = useCompareTrayHydrated();
  const items = useCompareTray((state) => state.items);
  const remove = useCompareTray((state) => state.remove);
  const clear = useCompareTray((state) => state.clear);
  const trayRef = useRef<HTMLElement>(null);

  if (!hydrated || items.length === 0) {
    return null;
  }
  const ready = items.length >= MIN_COMPARE;

  return (
    <aside
      ref={trayRef}
      tabIndex={-1}
      aria-label="Comparison tray"
      className="sticky bottom-4 z-30 mt-8 rounded-xl border bg-background/95 p-3 shadow-lg outline-none backdrop-blur supports-[backdrop-filter]:bg-background/85"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-sm font-medium">
          Comparing {items.length} of {MAX_COMPARE}
        </p>
        <ul className="flex flex-wrap gap-2">
          {items.map((item) => (
            <li key={item.id} className="inline-flex items-center gap-1 rounded-full border py-0.5 pr-0.5 pl-3 text-sm">
              <span className="max-w-48 truncate">{item.title}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                className="rounded-full"
                aria-label={`Remove ${item.title} from the comparison`}
                onClick={() => {
                  remove(item.id);
                  // The button is gone with its chip: keep focus in the tray.
                  trayRef.current?.focus({ preventScroll: true });
                }}
              >
                <X aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={clear}>
            Clear
          </Button>
          {ready ? (
            <Button asChild size="sm">
              <Link href={compareHref(items.map((item) => item.id))}>Compare</Link>
            </Button>
          ) : (
            <Button size="sm" disabled aria-describedby="compare-tray-hint">
              Compare
            </Button>
          )}
        </div>
      </div>
      {!ready && (
        <p id="compare-tray-hint" className="mt-1 text-xs text-muted-foreground">
          Add one more estimate to compare.
        </p>
      )}
    </aside>
  );
}
