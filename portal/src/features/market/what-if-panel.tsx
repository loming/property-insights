"use client";

import { ArrowDown, ArrowUp, Equal, RotateCcw, TriangleAlert } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { useFormatters } from "@/hooks/use-formatters";
import { useUrlState } from "@/hooks/use-url-state";
import type { HomeFeatures, MarketModelInfo, ModelWarning } from "@/lib/api/market";
import { FEATURE_BY_NAME, FEATURES, type FeatureName, formatFeatureValue } from "@/lib/features";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import { useWhatIf } from "./hooks/use-what-if";
import { SensitivityChart } from "./sensitivity-chart";
import {
  type Baseline,
  changesFrom,
  describeModelError,
  effectsOf,
  type FeatureRanges,
  PER_UNIT,
  SLIDER_STEPS,
} from "./what-if-model";

function withUnit(name: FeatureName, value: number): string {
  const unit = FEATURE_BY_NAME[name].unit;
  return `${formatFeatureValue(name, value)}${unit ? ` ${unit}` : ""}`;
}

/** Moves focus to the first slider thumb in `container`, once React has re-rendered. */
function focusSliderIn(container: HTMLElement | null) {
  requestAnimationFrame(() => container?.querySelector<HTMLElement>('[role="slider"]')?.focus());
}

function FeatureSlider({
  name,
  value,
  baseline,
  range,
  perUnit,
  onChange,
}: {
  name: FeatureName;
  value: number;
  baseline: number;
  range: { min: number; max: number };
  perUnit: number | undefined;
  onChange: (value: number) => void;
}) {
  const fmt = useFormatters();
  const feature = FEATURE_BY_NAME[name];
  const changed = Math.abs(value - baseline) > 1e-9;
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className="space-y-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          {feature.label}
          {changed && <Badge variant="secondary">Changed</Badge>}
        </span>
        <span className="text-sm tabular-nums">{withUnit(name, value)}</span>
      </div>
      <Slider
        min={range.min}
        max={range.max}
        step={SLIDER_STEPS[name]}
        value={[value]}
        onValueChange={([next]) => onChange(next!)}
        thumbLabels={[feature.label]}
        valueText={(v) => withUnit(name, v)}
      />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>
          Baseline {withUnit(name, baseline)}
          {perUnit !== undefined && (
            <>
              {" · "}model: {fmt.signedPrice(perUnit)} per {PER_UNIT[name]}
            </>
          )}
        </span>
        {changed && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              onChange(baseline);
              // The button goes once the value is back at the baseline: focus moves to the slider it reset.
              focusSliderIn(ref.current);
            }}
          >
            <RotateCcw aria-hidden="true" />
            Reset<span className="sr-only"> {feature.label.toLowerCase()}</span>
          </Button>
        )}
      </div>
    </div>
  );
}

function Warnings({ warnings }: { warnings: ModelWarning[] }) {
  const unique = [...new Map(warnings.map((w) => [`${w.code}:${w.field}`, w])).values()];
  if (unique.length === 0) {
    return null;
  }
  const unusual = unique.some((w) => w.code === "UNUSUAL_COMBINATION");
  return (
    <div className="rounded-lg border border-warning bg-warning/15 p-3 text-sm text-foreground">
      <p className="flex items-center gap-2 font-medium">
        <TriangleAlert aria-hidden="true" className="size-4" />
        Treat this price with caution
      </p>
      <ul className="mt-1 list-disc space-y-0.5 pl-6">
        {unique.map((w) => (
          <li key={`${w.code}:${w.field}`}>
            {w.field && FEATURE_BY_NAME[w.field as FeatureName] ? `${FEATURE_BY_NAME[w.field as FeatureName].label}: ` : ""}
            {w.message}
          </li>
        ))}
      </ul>
      {unusual && (
        <p className="mt-2">
          In the 50 homes the model learned from, size, lot, bedrooms, age and location all rise together. Changing
          one on its own makes a home unlike any of them, so the model is reaching beyond its data.
        </p>
      )}
    </div>
  );
}

function ResultCard({
  baseline,
  scenario,
  model,
}: {
  baseline: Baseline;
  scenario: HomeFeatures;
  model: MarketModelInfo | null;
}) {
  const fmt = useFormatters();
  const id = useId();
  const { data, error, isUpdating, refetch } = useWhatIf(baseline.features, scenario);
  const changes = changesFrom(baseline.features, scenario);
  const changed = Object.keys(changes).length > 0;
  // The breakdown needs the coefficients of the model that priced this; skipped if it has been rebuilt since.
  const effects =
    data && model && model.model_version === data.model_version ? effectsOf(changes, baseline.features, model) : [];
  const negative = model?.model_type === "linear_regression" ? effects.filter((e) => e.perUnit < 0) : [];
  const Direction = !data || Math.abs(data.delta) < 0.5 ? Equal : data.delta > 0 ? ArrowUp : ArrowDown;
  const status =
    !data || isUpdating
      ? ""
      : changed
        ? `Predicted ${fmt.price(data.scenario_price)}, ${data.delta >= 0 ? "up" : "down"} ${fmt.price(Math.abs(data.delta))} (${formatNumber(Math.abs(data.delta_pct))}%) from the baseline.`
        : `The baseline is predicted at ${fmt.price(data.baseline_price)}.`;

  return (
    <section
      aria-labelledby={`${id}-heading`}
      aria-busy={isUpdating}
      className="space-y-4 rounded-xl border p-4 lg:sticky lg:top-20"
    >
      <h2 id={`${id}-heading`} className="font-heading text-base font-semibold">
        Predicted price
      </h2>
      <p role="status" className="sr-only">
        {status}
      </p>
      {error ? (
        <Alert variant="destructive">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>{describeModelError(error).title}</AlertTitle>
          <AlertDescription>
            <p>{describeModelError(error).detail}</p>
            <Button className="mt-3" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : !data ? (
        <div className="space-y-3">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-5 w-56" />
        </div>
      ) : (
        <div className={cn("space-y-4 transition-opacity", isUpdating && "opacity-60")}>
          <div>
            <p className="font-heading text-3xl font-semibold tabular-nums">{fmt.price(data.scenario_price)}</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-medium tabular-nums">
                <Direction aria-hidden="true" className="size-4" />
                {changed ? `${fmt.signedExactPrice(data.delta)} (${fmt.signedPercent(data.delta_pct)})` : "No change yet"}
              </span>
              <span className="text-muted-foreground">from the baseline&apos;s {fmt.price(data.baseline_price)}</span>
            </p>
            {baseline.soldFor !== undefined && (
              <p className="mt-1 text-xs text-muted-foreground">This home actually sold for {fmt.price(baseline.soldFor)}.</p>
            )}
          </div>
          <p className="text-sm font-medium">Holding the other features constant.</p>
          {!changed && <p className="text-sm text-muted-foreground">Move a slider to change one feature at a time.</p>}
          {effects.length > 0 && (
            <div className="space-y-1.5 text-sm">
              <p className="text-muted-foreground">How the change adds up (the model is linear):</p>
              <ul className="divide-y rounded-lg border">
                {effects.map((e) => (
                  <li key={e.name} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
                    <span>
                      {FEATURE_BY_NAME[e.name].label}{" "}
                      <span className="text-muted-foreground">
                        {formatFeatureValue(e.name, e.from)} → {withUnit(e.name, e.to)}
                      </span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">{fmt.signedExactPrice(e.effect)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Warnings warnings={[...data.baseline_warnings, ...data.scenario_warnings]} />
          {negative.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Why can more {negative.map((e) => FEATURE_BY_NAME[e.name].label.toLowerCase()).join(" or ")} lower the
              price? Plain least squares, the model the brief asks for, gives{" "}
              {negative.map((e) => `${FEATURE_BY_NAME[e.name].label.toLowerCase()} ${fmt.signedPrice(e.perUnit)} per ${PER_UNIT[e.name]}`).join(" and ")}
              : the features move together in this data, so the fit hands most of the size signal to lot size. The Ridge
              set keeps every size coefficient positive.
            </p>
          )}
          <p className="text-xs text-muted-foreground">Model {data.model_version}</p>
        </div>
      )}
    </section>
  );
}

/**
 * M-3: start from a typical home or one from the data, change its features, and see the model's price
 * move. The baseline (and the Ridge set's sensitivity feature) are kept in the URL.
 */
export function WhatIfPanel({
  baselines,
  initialBaselineId,
  ranges,
  model,
  sensitivity,
}: {
  baselines: Baseline[];
  initialBaselineId: string;
  ranges: FeatureRanges;
  model: MarketModelInfo | null;
  /** The Ridge set only: the feature to sweep, from the URL. */
  sensitivity: { feature: FeatureName } | null;
}) {
  const { searchParams, replaceLocal } = useUrlState();
  const [baselineId, setBaselineId] = useState(initialBaselineId);
  const baseline = baselines.find((b) => b.id === baselineId) ?? baselines[0]!;
  const [scenario, setScenario] = useState<HomeFeatures>(baseline.features);
  const id = useId();
  const slidersRef = useRef<HTMLDivElement>(null);
  const changed = Object.keys(changesFrom(baseline.features, scenario)).length > 0;

  function chooseBaseline(next: string) {
    const picked = baselines.find((b) => b.id === next);
    if (!picked) {
      return;
    }
    setBaselineId(next);
    setScenario(picked.features);
    const params = new URLSearchParams(searchParams);
    params.set("baseline", next);
    replaceLocal(params);
  }

  return (
    <div className="space-y-6">
      <div className="max-w-xl space-y-1.5">
        <Label htmlFor={`${id}-baseline`}>Start from</Label>
        <NativeSelect
          id={`${id}-baseline`}
          className="w-full"
          value={baseline.id}
          onChange={(event) => chooseBaseline(event.target.value)}
        >
          <NativeSelectOptGroup label="Typical homes">
            {baselines
              .filter((b) => b.kind === "typical")
              .map((b) => (
                <NativeSelectOption key={b.id} value={b.id}>
                  {b.label}
                </NativeSelectOption>
              ))}
          </NativeSelectOptGroup>
          <NativeSelectOptGroup label="Homes in the data">
            {baselines
              .filter((b) => b.kind === "listed")
              .map((b) => (
                <NativeSelectOption key={b.id} value={b.id}>
                  {b.label}
                </NativeSelectOption>
              ))}
          </NativeSelectOptGroup>
        </NativeSelect>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        {/* First in reading order, so on a phone the price sits above the sliders that change it. */}
        <div className="lg:order-last">
          <ResultCard baseline={baseline} scenario={scenario} model={model} />
        </div>
        <section aria-labelledby={`${id}-features`} className="space-y-5 rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id={`${id}-features`} className="font-heading text-base font-semibold">
              Change the features
            </h2>
            <Button
              variant="outline"
              size="sm"
              disabled={!changed}
              onClick={() => {
                setScenario(baseline.features);
                // A disabled button loses focus: it moves to the first slider instead.
                focusSliderIn(slidersRef.current);
              }}
            >
              <RotateCcw aria-hidden="true" />
              Reset all
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Each slider covers the range of the homes in the data. The model prices every change with the other
            features held where they are.
          </p>
          <div ref={slidersRef} className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <FeatureSlider
                key={f.name}
                name={f.name}
                value={scenario[f.name]}
                baseline={baseline.features[f.name]}
                range={ranges[f.name]}
                perUnit={model?.coefficients.find((c) => c.feature === f.name)?.per_unit}
                onChange={(value) => setScenario((current) => ({ ...current, [f.name]: value }))}
              />
            ))}
          </div>
        </section>
      </div>

      {sensitivity && <SensitivityChart scenario={scenario} initialFeature={sensitivity.feature} ranges={ranges} />}
    </div>
  );
}
