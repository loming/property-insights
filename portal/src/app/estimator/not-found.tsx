import Link from "next/link";

import { Button } from "@/components/ui/button";

/** For notFound() in this app, e.g. an estimate that was deleted. */
export default function EstimateNotFound() {
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="font-heading text-2xl font-semibold">Estimate not found</h1>
      <p className="text-muted-foreground">It may have been deleted from the history.</p>
      <Button asChild>
        <Link href="/estimator/history">Go to the history</Link>
      </Button>
    </div>
  );
}
