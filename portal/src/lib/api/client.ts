import "server-only";

import { connection } from "next/server";

import { getServerEnv } from "./env";
import { ApiError, isProblem, type Problem, type Service } from "./problem";

export type FetchOptions = {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  /** Seconds to reuse the response (Next's data cache); omit for no-store. */
  revalidate?: number;
  tags?: string[];
  timeoutMs?: number;
};

/**
 * The one way server code reaches the backends: over the compose network, never through the gateway.
 * Sends an X-Request-ID that the backends log and pass on to ml-api, and turns any failure into an
 * ApiError carrying the backend's problem+json.
 */
export async function apiFetch<T>(service: Service, path: string, options: FetchOptions = {}): Promise<T> {
  // Request time only: no page can prerender backend data during `next build` (doc 02, E2).
  await connection();
  const env = getServerEnv();
  const base = service === "estimator" ? env.ESTIMATOR_API_URL : env.MARKET_API_URL;
  const requestId = crypto.randomUUID().replaceAll("-", "");
  const caching =
    options.revalidate === undefined
      ? { cache: "no-store" as const }
      : { next: { revalidate: options.revalidate, tags: options.tags } };

  let response: Response;
  try {
    // Appended, not resolved: a base with a path (the gateway's /estimator-api, for local dev) keeps it.
    response = await fetch(`${base.replace(/\/+$/, "")}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        "X-Request-ID": requestId,
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(options.timeoutMs ?? 8_000),
      ...caching,
    });
  } catch (cause) {
    const timedOut = cause instanceof DOMException && cause.name === "TimeoutError";
    throw new ApiError(
      {
        type: "service-unreachable",
        title: "Service Unavailable",
        status: 503,
        detail: timedOut ? `The ${service} service timed out` : `The ${service} service can't be reached`,
        request_id: requestId,
      },
      service,
      { cause },
    );
  }

  if (!response.ok) {
    throw new ApiError(await readProblem(response, requestId), service);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

async function readProblem(response: Response, requestId: string): Promise<Problem> {
  try {
    const body: unknown = await response.json();
    if (isProblem(body)) {
      return body;
    }
  } catch {
    // Not JSON: fall through to a generic problem.
  }
  return {
    type: "about:blank",
    title: response.statusText || "Error",
    status: response.status,
    detail: `The service answered ${response.status}`,
    request_id: requestId,
  };
}
