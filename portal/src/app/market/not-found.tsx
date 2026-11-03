import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function MarketNotFound() {
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="font-heading text-2xl font-semibold">Not found</h1>
      <p className="text-muted-foreground">That part of the market analysis doesn&apos;t exist.</p>
      <Button asChild>
        <Link href="/market">Go to the dashboard</Link>
      </Button>
    </div>
  );
}
