"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createEstimate, deleteEstimate, type Estimate } from "@/lib/api/estimator";
import { ApiError } from "@/lib/api/problem";

import { type ActionResult, fieldErrorsFromZod, invalid, toActionError } from "./action-result";
import { estimateSchema } from "./schema";

/**
 * Validates again on the server with the form's own schema (never trust the client), prices the home
 * through estimator-api, which saves it to the history, and returns the estimate or a typed failure.
 */
export async function createEstimateAction(input: unknown): Promise<ActionResult<Estimate>> {
  const parsed = estimateSchema.safeParse(input);
  if (!parsed.success) {
    return invalid(fieldErrorsFromZod(parsed.error));
  }
  try {
    const estimate = await createEstimate(parsed.data);
    revalidatePath("/estimator/history");
    return { ok: true, data: estimate };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteEstimateAction(id: unknown): Promise<ActionResult<null>> {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) {
    return invalid({ id: "Not a valid estimate id" });
  }
  try {
    await deleteEstimate(parsed.data);
  } catch (error) {
    // Already gone (deleted in another tab, say): that's the outcome the visitor asked for.
    if (!(error instanceof ApiError && error.status === 404)) {
      return toActionError(error);
    }
  }
  revalidatePath("/estimator/history");
  return { ok: true, data: null };
}
