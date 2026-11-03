import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "./client";
import { resetServerEnv } from "./env";
import { ApiError } from "./problem";

vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("ESTIMATOR_API_URL", "http://estimator-api:8001");
  vi.stubEnv("MARKET_API_URL", "http://market-api:8080");
  resetServerEnv();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function json(body: unknown, status = 200, type = "application/json") {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": type } });
}

describe("apiFetch", () => {
  it("calls the right backend with a request ID and returns the JSON", async () => {
    fetchMock.mockResolvedValue(json({ count: 50 }));
    await expect(apiFetch("market", "/api/v1/market/summary")).resolves.toEqual({ count: 50 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://market-api:8080/api/v1/market/summary");
    const headers = init!.headers as Record<string, string>;
    expect(headers["X-Request-ID"]).toMatch(/^[0-9a-f]{32}$/);
    expect(headers.Accept).toBe("application/json");
    expect(init!.cache).toBe("no-store");
  });

  it("uses the data cache only when asked", async () => {
    fetchMock.mockResolvedValue(json({}));
    await apiFetch("estimator", "/api/v1/model-info", { revalidate: 3600, tags: ["model-info"] });
    const init = fetchMock.mock.calls[0]![1] as RequestInit & { next?: unknown };
    expect(init.cache).toBeUndefined();
    expect(init.next).toEqual({ revalidate: 3600, tags: ["model-info"] });
  });

  it("sends JSON bodies", async () => {
    fetchMock.mockResolvedValue(json({ id: "x" }, 201));
    await apiFetch("estimator", "/api/v1/estimates", { method: "POST", body: { label: "a" } });
    const init = fetchMock.mock.calls[0]![1]!;
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"label":"a"}');
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("turns a problem+json response into an ApiError with its fields", async () => {
    const problem = {
      type: "validation-error",
      title: "Unprocessable Entity",
      status: 422,
      detail: "The request has invalid fields",
      request_id: "abc",
      errors: [{ field: "features.bathrooms", message: "Input should be a multiple of 0.5" }],
    };
    fetchMock.mockResolvedValue(json(problem, 422, "application/problem+json"));
    const error = await apiFetch("estimator", "/api/v1/estimates").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).problem).toEqual(problem);
    expect((error as ApiError).service).toBe("estimator");
    expect((error as ApiError).status).toBe(422);
  });

  it("makes a generic problem from an error that isn't problem+json", async () => {
    fetchMock.mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 502, statusText: "Bad Gateway" }));
    const error = (await apiFetch("market", "/x").catch((e: unknown) => e)) as ApiError;
    expect(error.problem).toMatchObject({ type: "about:blank", status: 502, title: "Bad Gateway" });
  });

  it("reports an unreachable or slow backend as a 503 problem", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    const unreachable = (await apiFetch("market", "/x").catch((e: unknown) => e)) as ApiError;
    expect(unreachable.problem).toMatchObject({ type: "service-unreachable", status: 503 });
    expect(unreachable.problem.detail).toContain("can't be reached");

    fetchMock.mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"));
    const slow = (await apiFetch("market", "/x").catch((e: unknown) => e)) as ApiError;
    expect(slow.problem.detail).toContain("timed out");
  });
});
