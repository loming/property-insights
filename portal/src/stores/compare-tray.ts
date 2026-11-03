import { z } from "zod";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

/** estimator-api compares 2 to 4 estimates (E-5). */
export const MIN_COMPARE = 2;
export const MAX_COMPARE = 4;

export type TrayItem = { id: string; title: string };

export type CompareTrayState = {
  items: TrayItem[];
  /** Returns false when the tray is already full. */
  add: (item: TrayItem) => boolean;
  remove: (id: string) => void;
  clear: () => void;
  /** Drops estimates that no longer exist, as the compare API reports them. */
  prune: (missingIds: readonly string[]) => void;
};

export type CompareTrayStore = ReturnType<typeof createCompareTrayStore>;

export const COMPARE_TRAY_KEY = "estimator-compare-tray";

/** localStorage when the browser allows it. Without it the tray still works, for this page view only. */
const browserStorage: StateStorage = {
  getItem: (name) => {
    try {
      return globalThis.localStorage?.getItem(name) ?? null;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      globalThis.localStorage?.setItem(name, value);
    } catch {
      // Blocked or full: keep going in memory.
    }
  },
  removeItem: (name) => {
    try {
      globalThis.localStorage?.removeItem(name);
    } catch {
      // As above.
    }
  },
};

// What's read back from storage is untrusted: anything that doesn't fit is dropped.
const persistedSchema = z.object({
  items: z.array(z.object({ id: z.uuid(), title: z.string().max(200) })),
});

function sanitise(persisted: unknown): TrayItem[] {
  const parsed = persistedSchema.safeParse(persisted);
  if (!parsed.success) {
    return [];
  }
  const unique = new Map(parsed.data.items.map((item) => [item.id, item]));
  return [...unique.values()].slice(0, MAX_COMPARE);
}

/**
 * The compare tray: up to four saved estimates, kept in localStorage per set (each hostname has its
 * own). One store per provider, never a module global, so server requests never share one; it's read
 * from storage only after hydration (skipHydration), so the first render matches the server's (doc 02, E5).
 */
export function createCompareTrayStore(storage: StateStorage = browserStorage) {
  return createStore<CompareTrayState>()(
    persist(
      (set, get) => ({
        items: [],
        add: (item) => {
          const { items } = get();
          if (items.some((existing) => existing.id === item.id)) {
            return true;
          }
          if (items.length >= MAX_COMPARE) {
            return false;
          }
          set({ items: [...items, item] });
          return true;
        },
        remove: (id) => set({ items: get().items.filter((item) => item.id !== id) }),
        clear: () => set({ items: [] }),
        prune: (missingIds) => {
          const missing = new Set(missingIds);
          const { items } = get();
          if (items.some((item) => missing.has(item.id))) {
            set({ items: items.filter((item) => !missing.has(item.id)) });
          }
        },
      }),
      {
        name: COMPARE_TRAY_KEY,
        version: 1,
        storage: createJSONStorage(() => storage),
        skipHydration: true,
        partialize: (state) => ({ items: state.items }),
        merge: (persisted, current) => ({ ...current, items: sanitise(persisted) }),
      },
    ),
  );
}
