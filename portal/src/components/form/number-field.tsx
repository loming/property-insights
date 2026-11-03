import type { UseFormRegisterReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * A labelled number input with its hint and error tied to it (aria-describedby, aria-invalid), so a
 * screen reader reads the unit, the hint and any error with the field (E-2, WCAG 3.3.1 and 3.3.2).
 */
export function NumberField({
  id,
  label,
  unit,
  hint,
  error,
  step,
  min,
  max,
  readOnly,
  registration,
}: {
  id: string;
  label: string;
  unit?: string;
  hint?: string;
  error?: string;
  step: number | "any";
  min: number;
  max: number;
  readOnly?: boolean;
  registration: UseFormRegisterReturn;
}) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {unit && <span className="font-normal text-muted-foreground"> ({unit})</span>}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode={step === 1 ? "numeric" : "decimal"}
        step={step}
        min={min}
        max={max}
        readOnly={readOnly}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...registration}
      />
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
