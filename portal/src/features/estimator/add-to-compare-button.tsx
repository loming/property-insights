"use client";

import { Check, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MAX_COMPARE } from "@/stores/compare-tray";

import { useCompareTray, useCompareTrayHydrated } from "./hooks/use-compare-tray";

/**
 * A toggle that puts an estimate in the compare tray or takes it out. Its name stays "Compare <title>"
 * and aria-pressed says whether it's in; it's disabled until the tray is read, and when the tray is full.
 */
export function AddToCompareButton({ id, title }: { id: string; title: string }) {
  const hydrated = useCompareTrayHydrated();
  const selected = useCompareTray((state) => state.items.some((item) => item.id === id));
  const full = useCompareTray((state) => state.items.length >= MAX_COMPARE);
  const add = useCompareTray((state) => state.add);
  const remove = useCompareTray((state) => state.remove);

  return (
    <Button
      size="sm"
      variant={selected ? "secondary" : "outline"}
      aria-pressed={selected}
      aria-label={`Compare ${title}`}
      title={!selected && full ? `The comparison holds ${MAX_COMPARE} estimates: remove one first` : undefined}
      disabled={!hydrated || (!selected && full)}
      onClick={() => (selected ? remove(id) : add({ id, title }))}
    >
      {selected ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
      Compare
    </Button>
  );
}
