"use client";

import { CircleAlert, Trash2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useRef, useState, useTransition } from "react";

import { DateTime } from "@/components/date-time";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFormatters } from "@/hooks/use-formatters";
import type { Estimate } from "@/lib/api/estimator";
import { warningText } from "@/lib/features";

import { deleteEstimateAction } from "./actions";
import { AddToCompareButton } from "./add-to-compare-button";
import { estimateTitle, homeSummary } from "./estimate-title";
import { useCompareTray } from "./hooks/use-compare-tray";

/**
 * A price with the model's warnings behind it. They open on hover and keyboard focus, and on a tap, which
 * Radix tooltips ignore by themselves: preventDefault stops Radix closing the tooltip on the same click.
 */
function WarnedPrice({ price, warnings }: { price: string; warnings: Estimate["warnings"] }) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        className="inline-flex min-h-6 cursor-help items-center gap-2 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
        onClick={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
      >
        {price}
        <Badge variant="outline" className="border-warning">
          <TriangleAlert aria-hidden="true" />
          {warnings.length === 1 ? "1 warning" : `${warnings.length} warnings`}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <ul className="list-disc space-y-1 pl-4">
          {warnings.map((warning, i) => (
            <li key={i}>{warningText(warning)}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

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
              const price = fmt.price(estimate.predicted_price);
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
                    {estimate.warnings.length > 0 ? <WarnedPrice price={price} warnings={estimate.warnings} /> : price}
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
