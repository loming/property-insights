"use client";

import { useEffect, useState } from "react";

import { COMPARE_TRAY_KEY, createCompareTrayStore } from "@/stores/compare-tray";

import { CompareTrayContext } from "./hooks/use-compare-tray";

/** One tray per browser tab, read from localStorage after hydration and kept in step with other tabs. */
export function CompareTrayProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(() => createCompareTrayStore());

  useEffect(() => {
    void store.persist.rehydrate();
    const onStorage = (event: StorageEvent) => {
      if (event.key === COMPARE_TRAY_KEY) {
        void store.persist.rehydrate();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [store]);

  return <CompareTrayContext value={store}>{children}</CompareTrayContext>;
}
