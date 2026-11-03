import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { HistoryTable } from "@/features/estimator/history-table";
import { listEstimates } from "@/lib/api/estimator";

export const metadata: Metadata = { title: "Estimate history" };

const PAGE_SIZE = 10;

function parsePage(value: string | string[] | undefined): number {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/** E-4: the saved estimates, newest first, a page at a time. Rendered on the server for every request. */
export default async function HistoryPage({ searchParams }: PageProps<"/estimator/history">) {
  const page = parsePage((await searchParams).page);
  const { items, total } = await listEstimates(PAGE_SIZE, (page - 1) * PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold">Estimate history</h1>
        <p className="text-sm text-muted-foreground">
          {total === 0
            ? "Every estimate you make is saved here."
            : `${total} saved ${total === 1 ? "estimate" : "estimates"}, newest first. Open one to see its details.`}
        </p>
      </div>

      {total === 0 ? (
        <div className="max-w-xl space-y-3 rounded-xl border border-dashed p-6">
          <p className="font-medium">No estimates yet</p>
          <p className="text-sm text-muted-foreground">Price a property and it appears here.</p>
          <Button asChild>
            <Link href="/estimator">Estimate a property</Link>
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p>
          Page {page} is empty.{" "}
          <Link href={`/estimator/history?page=${pages}`} className="underline underline-offset-4">
            Go to page {pages}
          </Link>
        </p>
      ) : (
        <>
          <HistoryTable estimates={items} />
          {pages > 1 && <Pagination page={page} pages={pages} />}
        </>
      )}
    </div>
  );
}

function Pagination({ page, pages }: { page: number; pages: number }) {
  return (
    <nav aria-label="History pages" className="flex items-center gap-3">
      {page > 1 ? (
        <Button asChild variant="outline" size="sm">
          <Link href={`/estimator/history?page=${page - 1}`}>
            <ChevronLeft aria-hidden="true" />
            Newer
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          <ChevronLeft aria-hidden="true" />
          Newer
        </Button>
      )}
      <span className="text-sm text-muted-foreground" aria-current="page">
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Button asChild variant="outline" size="sm">
          <Link href={`/estimator/history?page=${page + 1}`}>
            Older
            <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          Older
          <ChevronRight aria-hidden="true" />
        </Button>
      )}
    </nav>
  );
}
