"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * A chart as a figure with a caption and a table alternative. Screen readers always get the table (the
 * SVG is hidden from them); sighted users can switch to it too (WCAG 1.1.1, 1.4.1). Charts inside set
 * accessibilityLayer={false}: Recharts would otherwise make the hidden SVG focusable.
 */
export function ChartCard({
  title,
  description,
  table,
  controls,
  children,
}: {
  title: string;
  description: React.ReactNode;
  table: React.ReactNode;
  /** Choices that change what the chart shows, such as how to split the data. */
  controls?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);
  const id = useId();
  return (
    <figure aria-labelledby={`${id}-title`} className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <figcaption className="max-w-prose">
          <span id={`${id}-title`} className="block font-medium">
            {title}
          </span>
          <span className="block text-sm text-muted-foreground">{description}</span>
        </figcaption>
        <Button variant="outline" size="sm" aria-pressed={showTable} onClick={() => setShowTable((value) => !value)}>
          {showTable ? "Show chart" : "Show as table"}
        </Button>
      </div>
      {controls}
      {!showTable && <div aria-hidden="true">{children}</div>}
      <div className={showTable ? "overflow-x-auto" : "sr-only"}>{table}</div>
    </figure>
  );
}
