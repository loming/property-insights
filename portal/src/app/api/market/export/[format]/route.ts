import type { NextRequest } from "next/server";

import { filterSearchParams, formatSort, parseFilters, parseSort } from "@/features/market/filters";
import { getExport } from "@/lib/api/market";
import { notFound, problemResponse } from "@/lib/api/problem-response";

/**
 * M-4: the CSV or PDF of the homes matching the URL's filters, in the given sort order. Only known
 * parameters are passed on, and the file is streamed through from market-api as it arrives.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/market/export/[format]">) {
  const { format } = await params;
  if (format !== "csv" && format !== "pdf") {
    return notFound("Exports are csv or pdf");
  }
  const search = request.nextUrl.searchParams;
  const query = filterSearchParams(parseFilters(search));
  query.set("sort", formatSort(parseSort(search.get("sort") ?? undefined)));

  try {
    const upstream = await getExport(format, query);
    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? (format === "csv" ? "text/csv" : "application/pdf"),
        "Content-Disposition":
          upstream.headers.get("Content-Disposition") ?? `attachment; filename="property-market.${format}"`,
        // A download is of the moment it was made (doc 02, D9).
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return problemResponse(error);
  }
}
