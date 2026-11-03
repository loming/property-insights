import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="font-heading text-2xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">There&apos;s nothing at this address. It may have moved, or the link may be wrong.</p>
      <Button asChild>
        <Link href="/">Go to the overview</Link>
      </Button>
    </div>
  );
}
