"use client";

import { useSyncExternalStore } from "react";

import { formatDateTime } from "@/lib/format";

const subscribe = () => () => {};

/**
 * A timestamp in the visitor's own time zone. The server and the hydrating browser both print UTC, so
 * their HTML matches (doc 02, E5); the browser switches to local time straight after.
 */
export function DateTime({ iso }: { iso: string }) {
  const inBrowser = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return <time dateTime={iso}>{formatDateTime(iso, inBrowser ? undefined : "UTC")}</time>;
}
