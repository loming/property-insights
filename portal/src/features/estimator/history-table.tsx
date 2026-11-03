"use client";

import { CircleAlert, Trash2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useRef, useState, useTransition } from "react";

import { DateTime } from "@/components/date-time";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFormatters } from "@/hooks/use-formatters";
import type { Estimate } from "@/lib/api/estimator";

import { deleteEstimateAction } from "./actions";
import { AddToCompareButton } from "./add-to-compare-button";
import { estimateTitle, homeSummary } from "./estimate-title";
import { useCompareTray } from "./hooks/use-compare-tray";

/**
 * E-4: one page of the history. A deleted row goes at once (useOptimistic) and comes back with a
 * message if the delete fails; on success the Server Action re-renders the page from the server.
 */
export function HistoryTable({ estimates }: { estimates: Estimate[] }) {
  const fmt = useFormatters();
  const [rows, removeRow] = useOptimistic(estimates, (current, id: string) => current.filter((e) => e.id !== id));
  const [, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const removeFromTray = useCompareTray((state) => state.remove);

  const cancel = (id: string) => {
    setConfirming(null);
    requestAnimationFrame(() => document.getElementById(`delete-${id}`)?.focus());
  };

  const remove = (estimate: Estimate) => {
    const title = estimateTitle(estimate);
    setConfirming(null);
    setFailure(null);
    // The row and its buttons are about to go: keep focus in the table rather than lose it to the page.
    tableRef.current?.focus({ preventScroll: true });
    startTransition(async () => {
      removeRow(estimate.id);
      const outcome = await deleteEstimateAction(estimate.id);
      if (outcome.ok) {
        removeFromTray(estimate.id);
        setStatus(`Deleted ${title}.`);
      } else {
        setFailure(`${title} wasn't deleted. ${outcome.message}`);
      }
    });
  };

  return (
    <div className="space-y-3">
      {failure && (
        <Alert variant="destructive" className="max-w-2xl">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}
      <p role="status" className="sr-only">
        {status}
      </p>

      <div className="rounded-xl border">
        <Table ref={tableRef} tabIndex={-1} className="outline-none">
          <TableCaption className="sr-only">Saved estimates, newest first</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="px-3">Estimate</TableHead>
              <TableHead className="px-3 text-right">Estimated price</TableHead>
              <TableHead className="px-3">Saved</TableHead>
              <TableHead className="px-3">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((estimate) => {
              const title = estimateTitle(estimate);
              const warnings = estimate.warnings.length;
              return (
                <TableRow key={estimate.id}>
                  <TableCell className="px-3 whitespace-normal">
                    <Link
                      href={`/estimator/history/${estimate.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {title}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{homeSummary(estimate.features)}</span>
                  </TableCell>
                  <TableCell className="px-3 text-right tabular-nums">
                    {fmt.price(estimate.predicted_price)}
                    {warnings > 0 && (
                      <Badge variant="outline" className="ml-2 border-warning">
                        <TriangleAlert aria-hidden="true" />
                        {warnings === 1 ? "1 warning" : `${warnings} warnings`}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-3 text-muted-foreground">
                    <DateTime iso={estimate.created_at} />
                  </TableCell>
                  <TableCell className="space-x-2 px-3 text-right">
                    {confirming !== estimate.id && <AddToCompareButton id={estimate.id} title={title} />}
                    {confirming === estimate.id ? (
                      <div
                        role="group"
                        aria-label={`Delete ${title}?`}
                        className="inline-flex items-center gap-2"
                        onKeyDown={(event) => event.key === "Escape" && cancel(estimate.id)}
                      >
                        <span className="text-sm">Delete for good?</span>
                        <Button size="sm" variant="destructive" onClick={() => remove(estimate)}>
                          Delete
                        </Button>
                        <Button size="sm" variant="outline" autoFocus onClick={() => cancel(estimate.id)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        id={`delete-${estimate.id}`}
                        size="sm"
                        variant="ghost"
                        aria-label={`Delete ${title}`}
                        onClick={() => setConfirming(estimate.id)}
                      >
                        <Trash2 aria-hidden="true" />
                        Delete
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No estimates left on this page.</p>}
    </div>
  );
}
