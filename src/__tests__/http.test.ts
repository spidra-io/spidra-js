import { describe, expect, it } from "vitest";
import { HttpClient, parseRateLimitHeaders } from "../lib/http.js";
import {
  SpidraAuthenticationError,
  SpidraError,
  SpidraInsufficientCreditsError,
  SpidraNotFoundError,
  SpidraPaymentRequiredError,
  SpidraRateLimitError,
  SpidraServerError,
  SpidraValidationError,
} from "../lib/errors.js";
import { catchError, jsonResponse, networkError, sequenceFetch } from "./helpers.js";

function makeClient(fetchImpl: typeof fetch, overrides: { maxRetries?: number; backoffFactor?: number } = {}) {
  return new HttpClient({
    apiKey: "spd_test",
    baseUrl: "https://api.test",
    fetch: fetchImpl,
    maxRetries: overrides.maxRetries ?? 3,
    backoffFactor: overrides.backoffFactor ?? 1, // keep test backoff delays ~1ms
  });
}

describe("HttpClient error mapping", () => {
  const cases: Array<[number, unknown, new (...args: never[]) => SpidraError]> = [
    [401, SpidraAuthenticationError, SpidraAuthenticationError],
    [402, SpidraPaymentRequiredError, SpidraPaymentRequiredError],
    [403, SpidraInsufficientCreditsError, SpidraInsufficientCreditsError],
    [404, SpidraNotFoundError, SpidraNotFoundError],
    [429, SpidraRateLimitError, SpidraRateLimitError],
  ];

  for (const [status, , errorClass] of cases) {
    it(`maps ${status} to ${errorClass.name}`, async () => {
      const client = makeClient(sequenceFetch(jsonResponse(status, { message: "nope" })));
      const err = await catchError(client.get("/x"));
      expect(err).toBeInstanceOf(errorClass);
      expect(err).toBeInstanceOf(SpidraError);
      expect(err.status).toBe(status);
      expect(err.message).toBe("nope");
    });
  }

  it("maps 422 to SpidraValidationError with the errors array", async () => {
    const client = makeClient(
      sequenceFetch(jsonResponse(422, { errors: ["urls is required", "prompt is required"] }))
    );
    const err = await catchError(client.post("/scrape", {}));
    expect(err).toBeInstanceOf(SpidraValidationError);
    expect(err.errors).toEqual(["urls is required", "prompt is required"]);
    expect(err.message).toBe("urls is required; prompt is required");
  });

  it("maps any 5xx to SpidraServerError with the exact status", async () => {
    const client = makeClient(sequenceFetch(jsonResponse(500, { message: "boom" })), { maxRetries: 0 });
    const err = await catchError(client.get("/x"));
    expect(err).toBeInstanceOf(SpidraServerError);
    expect(err.status).toBe(500);
  });

  it("maps unlisted 4xx to the SpidraError base with status preserved", async () => {
    const client = makeClient(sequenceFetch(jsonResponse(418, { message: "teapot" })));
    const err = await catchError(client.get("/x"));
    expect(err).toBeInstanceOf(SpidraError);
    expect(err.constructor).toBe(SpidraError);
    expect(err.status).toBe(418);
  });

  it("carries the machine-readable code and raw body details", async () => {
    const body = { message: "busy", code: "SERVICE_BUSY", retry_after: 1 };
    const client = makeClient(sequenceFetch(jsonResponse(503, body)), { maxRetries: 0 });
    const err = await catchError(client.post("/scrape", {}));
    expect(err.code).toBe("SERVICE_BUSY");
    expect(err.details).toEqual(body);
  });
});

describe("HttpClient auth", () => {
  it("sends the API key as an Authorization: Bearer header", async () => {
    const fetchMock = sequenceFetch(jsonResponse(200, { ok: true }));
    const client = makeClient(fetchMock);
    await client.get("/x");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer spd_test");
  });
});

describe("HttpClient retries", () => {
  it("retries GET on 502 and succeeds", async () => {
    const fetchMock = sequenceFetch(jsonResponse(502, { message: "bad gateway" }), jsonResponse(200, { ok: true }));
    const client = makeClient(fetchMock);
    await expect(client.get("/x")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries GET on network errors", async () => {
    const fetchMock = sequenceFetch(networkError(), jsonResponse(200, { ok: true }));
    const client = makeClient(fetchMock);
    await expect(client.get("/x")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never retries POST on network errors (the job may already be queued)", async () => {
    const fetchMock = sequenceFetch(networkError(), jsonResponse(200, { ok: true }));
    const client = makeClient(fetchMock);
    await expect(client.post("/scrape", {})).rejects.toBeInstanceOf(TypeError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries POST on 503 (server explicitly rejected the submission)", async () => {
    const fetchMock = sequenceFetch(jsonResponse(503, { message: "busy" }), jsonResponse(202, { status: "queued" }));
    const client = makeClient(fetchMock);
    await expect(client.post("/scrape", {})).resolves.toEqual({ status: "queued" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry POST on 504 (the job may already be queued)", async () => {
    const fetchMock = sequenceFetch(jsonResponse(504, { message: "gateway timeout" }));
    const client = makeClient(fetchMock);
    const err = await catchError(client.post("/scrape", {}));
    expect(err).toBeInstanceOf(SpidraServerError);
    expect(err.status).toBe(504);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never retries 4xx", async () => {
    const fetchMock = sequenceFetch(jsonResponse(429, { message: "slow down" }));
    const client = makeClient(fetchMock);
    await expect(client.post("/scrape", {})).rejects.toBeInstanceOf(SpidraRateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after maxRetries and throws the mapped error", async () => {
    const fetchMock = sequenceFetch(jsonResponse(502, { message: "bad gateway" }));
    const client = makeClient(fetchMock, { maxRetries: 2 });
    await expect(client.get("/x")).rejects.toBeInstanceOf(SpidraServerError);
    expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("maxRetries: 0 disables retries entirely", async () => {
    const fetchMock = sequenceFetch(jsonResponse(502, { message: "bad gateway" }));
    const client = makeClient(fetchMock, { maxRetries: 0 });
    await expect(client.get("/x")).rejects.toBeInstanceOf(SpidraServerError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("applies exponential backoff between retries", async () => {
    const fetchMock = sequenceFetch(
      jsonResponse(502, { message: "x" }),
      jsonResponse(502, { message: "x" }),
      jsonResponse(200, { ok: true })
    );
    const client = makeClient(fetchMock, { backoffFactor: 20 });
    const start = Date.now();
    await client.get("/x");
    // delays: 20ms (attempt 0) + 40ms (attempt 1) = 60ms minimum
    expect(Date.now() - start).toBeGreaterThanOrEqual(55);
  });
});

describe("rate-limit header parsing", () => {
  it("parses draft-6 RateLimit-* headers", () => {
    const res = jsonResponse(429, {}, {
      "RateLimit-Limit": "60",
      "RateLimit-Remaining": "0",
      "RateLimit-Reset": "30",
    });
    const info = parseRateLimitHeaders(res.headers);
    expect(info.limit).toBe(60);
    expect(info.remaining).toBe(0);
    expect(info.resetAt).toBeInstanceOf(Date);
    expect(info.resetAt!.getTime()).toBeGreaterThan(Date.now() + 29_000);
    expect(info.retryAfterMs).toBe(30_000);
  });

  it("parses draft-7 combined RateLimit header", () => {
    const res = jsonResponse(429, {}, { RateLimit: "limit=60, remaining=5, reset=12" });
    const info = parseRateLimitHeaders(res.headers);
    expect(info.limit).toBe(60);
    expect(info.remaining).toBe(5);
    expect(info.retryAfterMs).toBe(12_000);
  });

  it("parses draft-8 RateLimit + RateLimit-Policy headers", () => {
    const res = jsonResponse(429, {}, {
      RateLimit: '"60-in-1min";r=0;t=25',
      "RateLimit-Policy": '"60-in-1min";q=60;w=60',
    });
    const info = parseRateLimitHeaders(res.headers);
    expect(info.limit).toBe(60);
    expect(info.remaining).toBe(0);
    expect(info.retryAfterMs).toBe(25_000);
  });

  it("prefers Retry-After header for retryAfterMs", () => {
    const res = jsonResponse(429, {}, { "Retry-After": "7", "RateLimit-Limit": "60", "RateLimit-Reset": "30" });
    const info = parseRateLimitHeaders(res.headers);
    expect(info.retryAfterMs).toBe(7_000);
  });

  it("falls back to the body retry_after field", () => {
    const res = jsonResponse(429, {});
    const info = parseRateLimitHeaders(res.headers, { retry_after: 4 });
    expect(info.retryAfterMs).toBe(4_000);
  });

  it("attaches metadata to SpidraRateLimitError", async () => {
    const client = makeClient(
      sequenceFetch(
        jsonResponse(
          429,
          { message: "limited", code: "TOO_MANY_PENDING_JOBS" },
          { RateLimit: '"default";r=0;t=10', "RateLimit-Policy": '"default";q=60;w=60' }
        )
      )
    );
    const err = (await catchError(client.post("/scrape", {}))) as SpidraRateLimitError;
    expect(err).toBeInstanceOf(SpidraRateLimitError);
    expect(err.limit).toBe(60);
    expect(err.remaining).toBe(0);
    expect(err.retryAfterMs).toBe(10_000);
    expect(err.code).toBe("TOO_MANY_PENDING_JOBS");
  });
});
