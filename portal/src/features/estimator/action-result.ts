import type { ZodError } from "zod";

import { ApiError } from "@/lib/api/problem";

/**
 * What a Server Action returns. Expected failures are values, not exceptions: thrown errors reach the
 * browser only as a digest, and the form needs the details (doc 02, E6).
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: "invalid"; message: string; fieldErrors: Record<string, string> }
  | { ok: false; kind: "outside-model-domain" | "unavailable" | "error"; message: string; requestId?: string };

export function invalid(fieldErrors: Record<string, string>): ActionResult<never> {
  return { ok: false, kind: "invalid", message: "Some fields need attention", fieldErrors };
}

export function fieldErrorsFromZod(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "form";
    errors[path] ??= issue.message;
  }
  return errors;
}

/** Turns a failed backend call into something the form can show next to the right field. */
export function toActionError(error: unknown): ActionResult<never> {
  if (!(error instanceof ApiError)) {
    console.error(error);
    return { ok: false, kind: "error", message: "Something went wrong. Try again." };
  }
  const { problem } = error;
  const requestId = problem.request_id ?? undefined;
  switch (problem.type) {
    case "validation-error":
      // estimator-api names fields as the form does (features.bathrooms), including ones the model rejected.
      return invalid(Object.fromEntries((problem.errors ?? []).map((e) => [e.field, e.message])));
    case "outside-model-domain":
      return {
        ok: false,
        kind: "outside-model-domain",
        message:
          "The model can't price this home: for this combination it predicts $0 or less. The values are valid, but far from the homes it was trained on. Check for an unusually large or small value.",
        requestId,
      };
    case "model-unavailable":
    case "service-unreachable":
      return {
        ok: false,
        kind: "unavailable",
        message: "The pricing service isn't responding right now. Try again in a moment.",
        requestId,
      };
    case "not-found":
      return { ok: false, kind: "error", message: "That estimate no longer exists.", requestId };
    default:
      return { ok: false, kind: "error", message: "The pricing service ran into a problem. Try again.", requestId };
  }
}
