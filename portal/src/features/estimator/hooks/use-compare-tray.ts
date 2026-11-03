"use client";

import { createContext, use, useCallback, useSyncExternalStore } from "react";
import { useStore } from "zustand";

import type { CompareTrayState, CompareTrayStore } from "@/stores/compare-tray";

export const CompareTrayContext = createContext<CompareTrayStore | null>(null);

function useTrayStore(): CompareTrayStore {
  const store = use(CompareTrayContext);
  if (!store) {
    throw new Error("The compare tray is only available inside <CompareTrayProvider> (the estimator layout)");
  }
  return store;
}

/** Reads from the compare tray. The selector must return a stable value (a field, not a new array). */
export function useCompareTray<T>(selector: (state: CompareTrayState) => T): T {
  return useStore(useTrayStore(), selector);
}

/** False until the tray has been read from localStorage: before that, it looks empty on purpose. */
export function useCompareTrayHydrated(): boolean {
  const store = useTrayStore();
  const subscribe = useCallback((onChange: () => void) => store.persist.onFinishHydration(onChange), [store]);
  return useSyncExternalStore(
    subscribe,
    () => store.persist.hasHydrated(),
    () => false,
  );
}
