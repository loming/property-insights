import { describe, expect, it } from "vitest";
import type { StateStorage } from "zustand/middleware";

import { COMPARE_TRAY_KEY, createCompareTrayStore, MAX_COMPARE } from "./compare-tray";

function memoryStorage(initial: Record<string, string> = {}): StateStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (name) => data.get(name) ?? null,
    setItem: (name, value) => void data.set(name, value),
    removeItem: (name) => void data.delete(name),
  };
}

const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const item = (n: number) => ({ id: id(n), title: `Home ${n}` });

describe("compare tray", () => {
  it("adds each estimate once, up to four", () => {
    const store = createCompareTrayStore(memoryStorage());
    const { add } = store.getState();
    expect(add(item(1))).toBe(true);
    expect(add(item(1))).toBe(true);
    for (const n of [2, 3, 4]) {
      add(item(n));
    }
    expect(add(item(5))).toBe(false);
    expect(store.getState().items.map((i) => i.id)).toEqual([id(1), id(2), id(3), id(4)]);
    expect(store.getState().items).toHaveLength(MAX_COMPARE);
  });

  it("removes, prunes and clears", () => {
    const store = createCompareTrayStore(memoryStorage());
    const { add, remove, prune, clear } = store.getState();
    [1, 2, 3].forEach((n) => add(item(n)));
    remove(id(2));
    expect(store.getState().items.map((i) => i.id)).toEqual([id(1), id(3)]);
    prune([id(3), id(9)]);
    expect(store.getState().items.map((i) => i.id)).toEqual([id(1)]);
    clear();
    expect(store.getState().items).toEqual([]);
  });

  it("waits for rehydrate() before reading storage, then saves changes", async () => {
    const storage = memoryStorage({
      [COMPARE_TRAY_KEY]: JSON.stringify({ state: { items: [item(1)] }, version: 1 }),
    });
    const store = createCompareTrayStore(storage);
    expect(store.getState().items).toEqual([]);
    expect(store.persist.hasHydrated()).toBe(false);

    await store.persist.rehydrate();
    expect(store.persist.hasHydrated()).toBe(true);
    expect(store.getState().items).toEqual([item(1)]);

    store.getState().add(item(2));
    expect(JSON.parse(storage.data.get(COMPARE_TRAY_KEY)!).state.items).toEqual([item(1), item(2)]);
  });

  it("drops stored data that doesn't fit: bad ids, duplicates, more than four", async () => {
    const stored = [item(1), { id: "not-a-uuid", title: "x" }, item(1), item(2), item(3), item(4), item(5)];
    const storage = memoryStorage({
      [COMPARE_TRAY_KEY]: JSON.stringify({ state: { items: stored }, version: 1 }),
    });
    const store = createCompareTrayStore(storage);
    await store.persist.rehydrate();
    expect(store.getState().items).toEqual([]);

    storage.setItem(COMPARE_TRAY_KEY, JSON.stringify({ state: { items: [item(1), item(1), ...[2, 3, 4, 5].map(item)] }, version: 1 }));
    await store.persist.rehydrate();
    expect(store.getState().items.map((i) => i.id)).toEqual([id(1), id(2), id(3), id(4)]);
  });
});
