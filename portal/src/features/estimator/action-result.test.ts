import { describe, expect, it, vi } from "vitest";

import { EXAMPLE_FEATURES } from "@/lib/features";
import { ApiError, type Problem } from "@/lib/api/problem";

import { fieldErrorsFromZod, toActionError } from "./action-result";
import { estimateSchema } from "./schema";

function apiError(problem: Partial<Problem> & { type: string; status: number }) {
  return new ApiError({ title: "t", request_id: "rid-1", ...problem }, "estimator");
}

describe("toActionError", () => {
  it("maps the backend's field errors onto form fields", () => {
    const result = toActionError(
      apiError({
        type: "validation-error",
        status: 422,
        errors: [{ field: "features.bathrooms", message: "Input should be a multiple of 0.5" }],
      }),
    );
    expect(result).toEqual({
      ok: false,
      kind: "invalid",
      message: "Some fields need attention",
      fieldErrors: { "features.bathrooms": "Input should be a multiple of 0.5" },
    });
  });

  it("explains a price the model can't produce", () => {
    const result = toActionError(apiError({ type: "outside-model-domain", status: 422 }));
    expect(result).toMatchObject({ ok: false, kind: "outside-model-domain", requestId: "rid-1" });
    expect(result.ok === false && result.message).toContain("$0 or less");
  });

  it("treats an unreachable model or backend as temporary", () => {
    for (const type of ["model-unavailable", "service-unreachable"]) {
      expect(toActionError(apiError({ type, status: 503 }))).toMatchObject({ ok: false, kind: "unavailable" });
    }
  });

  it("keeps other failures generic, without internals", () => {
    expect(toActionError(apiError({ type: "model-error", status: 502 }))).toMatchObject({ kind: "error" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(toActionError(new Error("secret"))).toEqual({ ok: false, kind: "error", message: "Something went wrong. Try again." });
  });
});

describe("fieldErrorsFromZod", () => {
  it("keys errors by field path, first message per field", () => {
    const result = estimateSchema.safeParse({ label: "a\nb", features: { ...EXAMPLE_FEATURES, bedrooms: 2.5 } });
    expect(result.success).toBe(false);
    expect(fieldErrorsFromZod(result.error!)).toEqual({
      label: "Keep the label to one line",
      "features.bedrooms": "Enter a whole number",
    });
  });
});
