import type { SpidraConfig } from "../types/client.js";
import {
  SpidraError,
  SpidraAuthenticationError,
  SpidraPaymentRequiredError,
  SpidraInsufficientCreditsError,
  SpidraNotFoundError,
  SpidraValidationError,
  SpidraRateLimitError,
  SpidraServerError,
  type RateLimitInfo,
} from "./errors.js";

type HttpMethod = "GET" | "POST" | "DELETE";

/**
 * Statuses safe to retry per method. GET/DELETE are idempotent so gateway
 * errors are always safe. POST is only retried when the server signalled it
 * did not accept the request (502 upstream unreachable, 503 SERVICE_BUSY) —
 * never 504, where the job may already have been queued.
 */
const RETRYABLE_STATUSES: Record<HttpMethod, readonly number[]> = {
  GET: [502, 503, 504],
  DELETE: [502, 503, 504],
  POST: [502, 503],
};

const MAX_RETRY_DELAY_MS = 30_000;

interface ApiErrorBody {
  message?: string;
  code?: string;
  errors?: string[];
  retry_after?: number;
}

export class HttpClient {
  private apiKey: string;
  private baseUrl: string;
  private fetch: typeof fetch;
  private maxRetries: number;
  private backoffFactor: number;

  constructor(config: SpidraConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? "https://api.spidra.io/api";
    this.fetch = config.fetch ?? globalThis.fetch;
    this.maxRetries = config.maxRetries ?? 3;
    this.backoffFactor = config.backoffFactor ?? 500;
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  /** Fetches a binary response (e.g. a zip download) instead of parsing JSON. */
  async getBlob(path: string): Promise<Blob> {
    const res = await this.fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!res.ok) {
      const errorBody = (await res.json().catch(() => ({ message: res.statusText }))) as ApiErrorBody;
      return this.throwError(res, errorBody);
    }

    return res.blob();
  }

  private async request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
    let attempt = 0;

    while (true) {
      let res: Response;
      try {
        res = await this.fetch(`${this.baseUrl}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            ...(body !== undefined && { "Content-Type": "application/json" }),
          },
          ...(body !== undefined && { body: JSON.stringify(body) }),
        });
      } catch (err) {
        // Network failure. For POST the request may have reached the server
        // (and queued a job), so never blind-retry it.
        if (method !== "POST" && attempt < this.maxRetries) {
          await sleep(this.backoffDelay(attempt++));
          continue;
        }
        throw err;
      }

      if (res.ok) {
        return res.json() as Promise<T>;
      }

      const errorBody = (await res.json().catch(() => ({ message: res.statusText }))) as ApiErrorBody;

      if (RETRYABLE_STATUSES[method].includes(res.status) && attempt < this.maxRetries) {
        const serverHint = parseRetryAfterMs(res.headers, errorBody);
        const delay = serverHint ?? this.backoffDelay(attempt);
        attempt++;
        await sleep(Math.min(delay, MAX_RETRY_DELAY_MS));
        continue;
      }

      return this.throwError(res, errorBody);
    }
  }

  private backoffDelay(attempt: number): number {
    return this.backoffFactor * 2 ** attempt;
  }

  private throwError(res: Response, body: ApiErrorBody): never {
    const message = body.message ?? (body.errors?.length ? body.errors.join("; ") : res.statusText);
    const options = { code: body.code, details: body };

    switch (res.status) {
      case 401:
        throw new SpidraAuthenticationError(message, options);
      case 402:
        throw new SpidraPaymentRequiredError(message, options);
      case 403:
        throw new SpidraInsufficientCreditsError(message, options);
      case 404:
        throw new SpidraNotFoundError(message, options);
      case 422:
        throw new SpidraValidationError(message, body.errors ?? [], options);
      case 429:
        throw new SpidraRateLimitError(message, parseRateLimitHeaders(res.headers, body), options);
      default:
        if (res.status >= 500) throw new SpidraServerError(message, res.status, options);
        throw new SpidraError(res.status, message, options);
    }
  }
}

/**
 * Parses rate-limit metadata from response headers. Handles the IETF drafts
 * emitted by express-rate-limit — draft-6 (`RateLimit-Limit`/`-Remaining`/`-Reset`),
 * draft-7 (`RateLimit: limit=60, remaining=59, reset=30`), draft-8
 * (`RateLimit: "policy";r=59;t=30` + `RateLimit-Policy: "policy";q=60;w=60`) —
 * plus legacy `X-RateLimit-*`.
 */
export function parseRateLimitHeaders(headers: Headers, body?: ApiErrorBody): RateLimitInfo {
  const info: RateLimitInfo = {};

  const num = (v: string | null | undefined): number | undefined => {
    if (v == null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  let resetSeconds: number | undefined;

  const draft6Limit = num(headers.get("ratelimit-limit")) ?? num(headers.get("x-ratelimit-limit"));
  if (draft6Limit !== undefined) {
    info.limit = draft6Limit;
    info.remaining = num(headers.get("ratelimit-remaining")) ?? num(headers.get("x-ratelimit-remaining"));
    resetSeconds = num(headers.get("ratelimit-reset")) ?? num(headers.get("x-ratelimit-reset"));
  } else {
    const combined = headers.get("ratelimit");
    if (combined) {
      const fields = parseKeyValueFields(combined);
      // draft-7 uses limit/remaining/reset; draft-8 uses r (remaining) / t (reset)
      info.limit = num(fields.limit);
      info.remaining = num(fields.remaining) ?? num(fields.r);
      resetSeconds = num(fields.reset) ?? num(fields.t);

      const policy = headers.get("ratelimit-policy");
      if (policy && info.limit === undefined) {
        info.limit = num(parseKeyValueFields(policy).q);
      }
    }
  }

  if (resetSeconds !== undefined) {
    info.resetAt = new Date(Date.now() + resetSeconds * 1000);
  }

  info.retryAfterMs = parseRetryAfterMs(headers, body) ?? (resetSeconds !== undefined ? resetSeconds * 1000 : undefined);

  return info;
}

/** Parses `key=value` items separated by `,` or `;`, tolerating quoted policy names. */
function parseKeyValueFields(header: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const part of header.split(/[,;]/)) {
    const [key, value] = part.split("=").map((s) => s.trim().replace(/^"|"$/g, ""));
    if (key && value !== undefined) fields[key.toLowerCase()] = value;
  }
  return fields;
}

/** Reads `Retry-After` (seconds or HTTP-date) or the body's `retry_after` (seconds). */
function parseRetryAfterMs(headers: Headers, body?: ApiErrorBody): number | undefined {
  const header = headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return seconds * 1000;
    const date = Date.parse(header);
    if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  }
  if (typeof body?.retry_after === "number") return body.retry_after * 1000;
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
