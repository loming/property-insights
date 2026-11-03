import { z } from "zod";

import { MAX_COMPARE } from "@/stores/compare-tray";

const uuid = z.uuid();

/**
 * The compare page's ids from ?ids=a,b (a repeated ?ids= works too): valid UUIDs only, each once,
 * at most four. Anything else in the URL is ignored rather than an error.
 */
export function parseCompareIds(value: string | string[] | undefined): string[] {
  const parts = (Array.isArray(value) ? value : [value ?? ""]).flatMap((v) => v.split(","));
  const ids = parts.map((part) => part.trim().toLowerCase()).filter((part) => uuid.safeParse(part).success);
  return [...new Set(ids)].slice(0, MAX_COMPARE);
}

export function compareHref(ids: readonly string[]): string {
  return `/estimator/compare?ids=${ids.join(",")}`;
}
