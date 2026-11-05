import Link from "next/link";
import { Suspense } from "react";

import { ServiceStatus, ServiceStatusSkeleton } from "@/components/layout/service-status";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Overview() {
  return (
    <div className="space-y-8">
      <div className="max-w-2xl space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Property Insights</h1>
        <p className="text-muted-foreground">
          Two applications on one regression model of a 50-home dataset: estimate a property&apos;s price, or
          analyse the market and ask what-if questions.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        <li>
          <Link href="/estimator" className="group block rounded-xl focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none">
            <Card className="h-full transition-colors group-hover:border-primary">
              <CardHeader>
                <CardTitle>Property Value Estimator</CardTitle>
                <CardDescription>Price a property, keep a history and compare estimates side by side.</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </li>
        <li>
          <Link href="/market" className="group block rounded-xl focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none">
            <Card className="h-full transition-colors group-hover:border-primary">
              <CardHeader>
                <CardTitle>Property Market Analysis</CardTitle>
                <CardDescription>Explore market segments, export the data and run what-if scenarios.</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </li>
      </ul>
      <section aria-labelledby="status-heading" className="space-y-2">
        <h2 id="status-heading" className="font-heading text-lg font-semibold">
          Service status
        </h2>
        {/* Streams in after the page; a slow or down backend never blocks the rest. */}
        <Suspense fallback={<ServiceStatusSkeleton />}>
          <ServiceStatus />
        </Suspense>
      </section>
    </div>
  );
}
