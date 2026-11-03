"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUrlState } from "@/hooks/use-url-state";
import type { PropertyRow } from "@/lib/api/market";
import { cn } from "@/lib/utils";

import { ExportMenu } from "./export-menu";
import { DEFAULT_SORT, formatSort, type Sort, type SortField } from "./filters";
import { COLUMNS, nextSort, pageOf, searchRows, sortRows } from "./property-table-model";

const PAGE_SIZES = [10, 25, 50];

function sortName(sort: Sort): string {
  const column = COLUMNS.find((c) => c.field === sort.field);
  const name = (column?.description ?? column?.label ?? sort.field).toLowerCase();
  return `${name}, ${sort.direction === "asc" ? "lowest first" : "highest first"}`;
}

/**
 * M-5: the filtered homes, sortable by any column (the sort is kept in the URL and used by the exports),
 * searchable and paged in the browser. On a phone the table scrolls sideways inside its box, with the
 * home number pinned on the left.
 */
export function PropertyTable({
  rows,
  initialSort,
  filterQuery,
}: {
  rows: PropertyRow[];
  initialSort: Sort;
  /** The filters as a query string (a prop from the server must be serialisable). */
  filterQuery: string;
}) {
  const { searchParams, replaceLocal } = useUrlState();
  const [sort, setSort] = useState(initialSort);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]!);
  const id = useId();

  const found = searchRows(rows, search);
  const view = pageOf(sortRows(found, sort), page, pageSize);
  const exportQuery = new URLSearchParams(filterQuery);
  exportQuery.set("sort", formatSort(sort));

  function sortBy(field: SortField) {
    const next = nextSort(sort, field);
    setSort(next);
    const params = new URLSearchParams(searchParams);
    if (next.field === DEFAULT_SORT.field && next.direction === DEFAULT_SORT.direction) {
      params.delete("sort");
    } else {
      params.set("sort", formatSort(next));
    }
    replaceLocal(params);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="w-full max-w-xs space-y-1.5">
          <Label htmlFor={`${id}-search`}>Search these homes</Label>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={`${id}-search`}
              type="search"
              className="pl-8"
              placeholder="e.g. 2010 or #17"
              aria-describedby={`${id}-search-hint`}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <p id={`${id}-search-hint`} className="text-xs text-muted-foreground">
            Matches any value; several words must all match.
          </p>
        </div>
        <ExportMenu query={exportQuery} count={rows.length} />
      </div>

      <p role="status" className="text-sm text-muted-foreground">
        {found.length === 0
          ? `No homes match “${search.trim()}”.`
          : `Showing ${view.from}–${view.to} of ${found.length} ${found.length === 1 ? "home" : "homes"}${search.trim() ? ` matching “${search.trim()}”` : ""}.`}
      </p>

      <div className="rounded-xl border">
        <Table>
          <caption className="sr-only">
            Homes matching the filters, sorted by {sortName(sort)}
          </caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {COLUMNS.map((column, i) => {
                const active = sort.field === column.field;
                const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
                return (
                  <TableHead
                    key={column.field}
                    scope="col"
                    aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}
                    className={cn("px-1", i > 0 && "text-right", i === 0 && "sticky left-0 z-10 bg-background")}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn("font-medium", i > 0 && "ml-auto flex")}
                      onClick={() => sortBy(column.field)}
                    >
                      {column.description ? (
                        <>
                          <span aria-hidden="true">{column.label}</span>
                          <span className="sr-only">{column.description}</span>
                        </>
                      ) : (
                        column.label
                      )}
                      <Icon aria-hidden="true" className={cn(!active && "text-muted-foreground")} />
                    </Button>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.rows.map((row) => (
              <TableRow key={row.id}>
                {COLUMNS.map((column, i) =>
                  i === 0 ? (
                    <TableHead key={column.field} scope="row" className="sticky left-0 z-10 bg-background px-3 font-medium">
                      {column.format(row)}
                    </TableHead>
                  ) : (
                    <TableCell key={column.field} className="px-3 text-right tabular-nums">
                      {column.format(row)}
                    </TableCell>
                  ),
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor={`${id}-size`} className="text-sm font-normal text-muted-foreground">
            Rows per page
          </Label>
          <NativeSelect
            id={`${id}-size`}
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
          >
            {PAGE_SIZES.map((size) => (
              <NativeSelectOption key={size} value={size}>
                {size}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <nav aria-label="Table pages" className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={view.page <= 1} onClick={() => setPage(view.page - 1)}>
            <ChevronLeft aria-hidden="true" />
            Previous
          </Button>
          <span className="text-sm tabular-nums">
            Page {view.page} of {view.pages}
          </span>
          <Button variant="outline" size="sm" disabled={view.page >= view.pages} onClick={() => setPage(view.page + 1)}>
            Next
            <ChevronRight aria-hidden="true" />
          </Button>
        </nav>
      </div>
    </div>
  );
}
