"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { type FieldPath, useForm } from "react-hook-form";

import { ErrorSummary, type SummaryError } from "@/components/form/error-summary";
import { NumberField } from "@/components/form/number-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormatters } from "@/hooks/use-formatters";
import type { Estimate } from "@/lib/api/estimator";
import { EXAMPLE_FEATURES, FEATURES } from "@/lib/features";

import type { ActionResult } from "./action-result";
import { createEstimateAction } from "./actions";
import { EstimateResult } from "./estimate-result";
import type { PriceDistribution } from "./price-distribution-chart";
import { type EstimateInput, type EstimateValues, estimateSchema } from "./schema";

type FormFailure = Extract<ActionResult<never>, { kind: "outside-model-domain" | "unavailable" | "error" }>;

const fieldId = (path: string) => `field-${path.replace(".", "-")}`;

/**
 * E-1/E-2: every model field, validated in the browser with the same schema the Server Action uses.
 * Errors show inline and in a summary, and focus moves to the first invalid field; the server's field
 * errors land on the same fields. A home the model can't price gets a form-level message.
 */
export function EstimateForm({
  distribution,
  trainingRanges,
  showContributions,
}: {
  distribution: PriceDistribution;
  trainingRanges: Record<string, { min: number; max: number }>;
  showContributions: boolean;
}) {
  const fmt = useFormatters();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Estimate | null>(null);
  const [failure, setFailure] = useState<FormFailure | null>(null);
  const form = useForm<EstimateInput, unknown, EstimateValues>({
    resolver: zodResolver(estimateSchema),
    defaultValues: { label: "", features: EXAMPLE_FEATURES },
    mode: "onTouched",
    shouldFocusError: true,
  });
  const { errors, submitCount } = form.formState;

  const summary: SummaryError[] = [
    ...(errors.label?.message ? [{ id: fieldId("label"), label: "Label", message: errors.label.message }] : []),
    ...FEATURES.flatMap((f) => {
      const message = errors.features?.[f.name]?.message;
      return message ? [{ id: fieldId(`features.${f.name}`), label: f.label, message }] : [];
    }),
  ];

  const onSubmit = form.handleSubmit((values) => {
    setFailure(null);
    startTransition(async () => {
      const outcome = await createEstimateAction(values);
      if (outcome.ok) {
        setResult(outcome.data);
        return;
      }
      if (outcome.kind === "invalid") {
        const paths = Object.keys(outcome.fieldErrors);
        for (const path of paths) {
          form.setError(path as FieldPath<EstimateInput>, { type: "server", message: outcome.fieldErrors[path] });
        }
        if (paths[0]) {
          form.setFocus(paths[0] as FieldPath<EstimateInput>);
        }
        return;
      }
      setFailure(outcome);
    });
  });

  return (
    <div className="space-y-8">
      <form onSubmit={onSubmit} noValidate aria-describedby="estimate-form-help" className="space-y-5">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold">Estimate a property</h1>
          <p id="estimate-form-help" className="text-sm text-muted-foreground">
            Every field is required, except the label. The form starts with a typical home; values outside the
            training range still get a price, with a warning.
          </p>
        </div>

        {submitCount > 0 && <ErrorSummary errors={summary} />}

        <div className="max-w-sm space-y-1.5">
          <Label htmlFor={fieldId("label")}>
            Label <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id={fieldId("label")}
            placeholder="e.g. Flat on Elm St"
            maxLength={80}
            aria-invalid={errors.label ? true : undefined}
            aria-describedby={errors.label ? `${fieldId("label")}-error` : undefined}
            {...form.register("label")}
          />
          {errors.label && (
            <p id={`${fieldId("label")}-error`} className="text-sm font-medium text-destructive">
              {errors.label.message}
            </p>
          )}
        </div>

        <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <legend className="sr-only">Property features</legend>
          {FEATURES.map((f) => {
            const range = trainingRanges[f.name];
            const hint = range ? `${f.hint}. Training data: ${fmt.number(range.min)}–${fmt.number(range.max)}` : f.hint;
            return (
              <NumberField
                key={f.name}
                id={fieldId(`features.${f.name}`)}
                label={f.label}
                unit={f.unit}
                hint={hint}
                error={errors.features?.[f.name]?.message}
                step={f.step}
                min={f.min}
                max={f.max}
                registration={form.register(`features.${f.name}`, { valueAsNumber: true })}
              />
            );
          })}
        </fieldset>

        {failure && (
          <Alert variant="destructive" className="max-w-2xl">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>{failure.kind === "outside-model-domain" ? "The model can't price this home" : "No estimate this time"}</AlertTitle>
            <AlertDescription>
              <p>{failure.message}</p>
              {failure.requestId && <p className="text-xs">Reference: {failure.requestId}</p>}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" disabled={pending}>
            {pending && <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
            {pending ? "Estimating…" : "Estimate price"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => {
              form.reset({ label: "", features: EXAMPLE_FEATURES });
              setFailure(null);
            }}
          >
            Reset to the example home
          </Button>
        </div>
      </form>

      {/* Announced to screen readers when a new estimate arrives. */}
      <p aria-live="polite" className="sr-only">
        {result ? `Estimated price ${fmt.price(result.predicted_price)}. Saved to your history.` : ""}
      </p>

      {result && (
        <EstimateResult
          key={result.id}
          estimate={result}
          distribution={distribution}
          showContributions={showContributions}
          justSaved
        />
      )}
    </div>
  );
}
