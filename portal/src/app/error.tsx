"use client";

import { ErrorState } from "@/components/layout/error-state";

export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorState title="Something went wrong" error={error} retry={retry} />;
}
