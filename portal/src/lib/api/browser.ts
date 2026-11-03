import { ApiError, isProblem, type Service } from "./problem";

/**
 * POSTs JSON to one of the portal's own Route Handlers from the browser. A failure becomes an ApiError
 * with the problem+json the handler passed on, or a network problem when nothing answered.
 */
export async function postJson<T>(service: Service, url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (cause) {
    if (signal?.aborted) {
      throw cause;
    }
    throw new ApiError(
      { type: "network-error", title: "Network error", status: 0, detail: "The request didn't reach the server" },
      service,
      { cause },
    );
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      isProblem(data)
        ? data
        : { type: "about:blank", title: response.statusText || "Error", status: response.status, detail: `The server answered ${response.status}` },
      service,
    );
  }
  return data as T;
}
