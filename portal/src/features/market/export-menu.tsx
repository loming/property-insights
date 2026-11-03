"use client";

import { AlertTriangle, Download, FileSpreadsheet, FileText, LoaderCircle } from "lucide-react";
import { useId } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFileDownload } from "@/hooks/use-file-download";

/**
 * M-4: downloads of the homes matching the filters, in the table's sort order, made by market-api and
 * passed through the portal's Route Handler. The note says what is and isn't included.
 */
export function ExportMenu({ query, count }: { query: URLSearchParams; count: number }) {
  const { download, pending, error } = useFileDownload();
  const noteId = useId();
  const href = (format: "csv" | "pdf") => `/api/market/export/${format}${query.size > 0 ? `?${query}` : ""}`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={pending !== null || count === 0} aria-describedby={noteId}>
              {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Download aria-hidden="true" />}
              {pending ? "Preparing the file…" : "Export"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onSelect={() => void download(href("csv"), "property-market.csv")}>
              <FileSpreadsheet aria-hidden="true" />
              CSV, for a spreadsheet
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void download(href("pdf"), "property-market.pdf")}>
              <FileText aria-hidden="true" />
              PDF report
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <p id={noteId} className="text-sm text-muted-foreground">
          Exports the {count} {count === 1 ? "home" : "homes"} matching the filters, in the table&apos;s order. The
          search box doesn&apos;t apply to exports.
        </p>
      </div>
      {error && (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>The export didn&apos;t download</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
