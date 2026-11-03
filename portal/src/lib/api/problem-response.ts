import "server-only";

import type { z } from "zod";

import { ApiError, type Problem } from "./problem";

const HEADERS = { "Content-Type": "application/problem+json", "Cache-Control": "no-store" };

/** A Route Handler's answer for a failure: the backend's problem+json as it came, or a generic 500. */
export function problemResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(error.problem, { status: error.status, headers: HEADERS });
  }
  console.error(error);
  const problem: Problem = {
    type: "about:blank",
    title: "Internal Server Error",
    status: 500,
    detail: "Something went wrong in the portal",
  };
  return Response.json(problem, { status: 500, headers: HEADERS });
}

/** 400 with the field errors of a request body that failed its schema, in the backends' format. */
export function invalidRequest(error: z.ZodError | null, detail = "The request has invalid fields"): Response {
  const problem: Problem = {
    type: "validation-error",
    title: "Bad Request",
    status: 400,
    detail,
    errors: error?.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })) ?? [],
  };
  return Response.json(problem, { status: 400, headers: HEADERS });
}

export function notFound(detail: string): Response {
  return Response.json({ type: "about:blank", title: "Not Found", status: 404, detail } satisfies Problem, {
    status: 404,
    headers: HEADERS,
  });
}
