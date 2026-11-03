"use client";

import { SlidersHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { FilterOptions } from "@/lib/api/market";
import { formatNumber, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

import { useMarketFilters } from "./filter-context";
import {
  type Bounds,
  describeFilters,
  type MarketFilters,
  RANGE_FILTERS,
  type RangeFilter,
  roundToStep,
  sliderBounds,
} from "./filters";

const COMMIT_DELAY_MS = 400;

/** A thumb's value as a screen reader hears it: "$250,000", "1,200 sq ft". */
function formatValue(range: RangeFilter, value: number): string {
  switch (range.name) {
    case "price":
      return formatPrice(value);
    case "year":
      return String(value);
    case "sqft":
      return `${formatNumber(value)} sq ft`;
    case "distance":
      return `${formatNumber(value)} miles`;
    default:
      return formatNumber(value);
  }
}

/** Both ends, compactly, with the unit once: "$160k–$410k", "980–2,400 sq ft". */
function formatSpan(range: RangeFilter, [low, high]: number[]): string {
  const short = (value: number) =>
    range.name === "price" ? `$${formatNumber(Math.round(value / 1000))}k` : range.name === "year" ? String(value) : formatNumber(value);
  const unit = range.name === "sqft" ? " sq ft" : range.name === "distance" ? " mi" : "";
  return `${short(low!)}–${short(high!)}${unit}`;
}

function RangeControl({ range, bounds }: { range: RangeFilter; bounds: Bounds }) {
  const { filters, setFilters } = useMarketFilters();
  const id = useId();
  const clamp = (value: number) => Math.min(bounds.max, Math.max(bounds.min, value));
  const current: [number, number] = [
    clamp(filters[range.minParam] ?? bounds.min),
    clamp(filters[range.maxParam] ?? bounds.max),
  ];
  // While a thumb moves; committed (and sent to the server) once it rests.
  const [draft, setDraft] = useState<[number, number] | null>(null);
  const value = draft ?? current;
  const label = range.label.toLowerCase();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Each arrow key press is a commit; waiting for a pause makes eight presses one page load, not eight.
  function scheduleCommit(next: number[]) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(next), COMMIT_DELAY_MS);
  }

  function commit([low, high]: number[]) {
    setDraft(null);
    const next: MarketFilters = { ...filters };
    // A thumb at the end of the range means no limit on that side.
    const tolerance = range.step / 2;
    next[range.minParam] = low! > bounds.min + tolerance ? roundToStep(low!, range.step) : undefined;
    next[range.maxParam] = high! < bounds.max - tolerance ? roundToStep(high!, range.step) : undefined;
    if (next[range.minParam] !== filters[range.minParam] || next[range.maxParam] !== filters[range.maxParam]) {
      setFilters(next);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span id={`${id}-label`} className="font-medium">
          {range.label}
        </span>
        <span className="shrink-0 text-muted-foreground tabular-nums">{formatSpan(range, value)}</span>
      </div>
      <Slider
        aria-labelledby={`${id}-label`}
        min={bounds.min}
        max={bounds.max}
        step={range.step}
        value={value}
        minStepsBetweenThumbs={0}
        onValueChange={(next) => setDraft([next[0]!, next[1]!])}
        onValueCommit={scheduleCommit}
        thumbLabels={[`Lowest ${label}`, `Highest ${label}`]}
        valueText={(v) => formatValue(range, v)}
        className="py-1.5"
      />
    </div>
  );
}

function BedroomsControl({ choices }: { choices: number[] }) {
  const { filters, setFilters } = useMarketFilters();
  const id = useId();
  function toggle(bedrooms: number, checked: boolean) {
    const next = checked ? [...filters.bedrooms, bedrooms] : filters.bedrooms.filter((b) => b !== bedrooms);
    setFilters({ ...filters, bedrooms: [...new Set(next)].sort((a, b) => a - b) });
  }
  return (
    <fieldset className="space-y-2.5">
      <legend className="text-sm font-medium">Bedrooms</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {choices.map((bedrooms) => (
          <div key={bedrooms} className="flex items-center gap-2">
            <Checkbox
              id={`${id}-${bedrooms}`}
              checked={filters.bedrooms.includes(bedrooms)}
              onCheckedChange={(checked) => toggle(bedrooms, checked === true)}
            />
            <Label htmlFor={`${id}-${bedrooms}`} className="font-normal">
              {bedrooms} bed
            </Label>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">None ticked: every home.</p>
    </fieldset>
  );
}

/**
 * M-2's filters: bedrooms and six ranges bounded by the data. They apply on the server to everything
 * below them (figures, charts, the table and its exports), and the URL keeps them, so a link shares the
 * view. On a phone the controls fold away behind a button.
 */
export function FilterBar({ options }: { options: FilterOptions }) {
  const { filters, setFilters } = useMarketFilters();
  const [open, setOpen] = useState(false);
  const id = useId();
  const active = describeFilters(filters);

  return (
    <section aria-labelledby={`${id}-heading`} className="rounded-xl border p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id={`${id}-heading`} className="font-heading text-base font-semibold">
          Filters
        </h2>
        {active.length > 0 && <Badge variant="secondary">{active.length} active</Badge>}
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="md:hidden"
            aria-expanded={open}
            aria-controls={`${id}-controls`}
            onClick={() => setOpen((value) => !value)}
          >
            <SlidersHorizontal aria-hidden="true" />
            {open ? "Hide filters" : "Show filters"}
          </Button>
          <Button variant="ghost" size="sm" disabled={active.length === 0} onClick={() => setFilters({ bedrooms: [] })}>
            Clear all
          </Button>
        </div>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {active.length > 0 ? `Showing homes matching: ${active.join("; ")}.` : "Showing every home in the data."}
      </p>
      <div
        id={`${id}-controls`}
        className={cn("mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4", open ? "grid" : "hidden md:grid")}
      >
        <BedroomsControl choices={options.bedrooms} />
        {RANGE_FILTERS.map((range) => {
          const data = options.ranges[range.bounds];
          return data ? <RangeControl key={range.name} range={range} bounds={sliderBounds(range, data)} /> : null;
        })}
      </div>
    </section>
  );
}
