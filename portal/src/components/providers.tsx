"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/** One QueryClient per browser session (never shared between server requests). */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false } } }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
