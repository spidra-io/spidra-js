export interface SpidraErrorOptions {
  /** Machine-readable error code from the API, e.g. `"SERVICE_BUSY"` or `"TOO_MANY_PENDING_JOBS"`. */
  code?: string;
  /** The raw error body returned by the API, when one was available. */
  details?: unknown;
}

/**
 * Base class for every error thrown by the Spidra SDK.
 *
 * `status` is the HTTP status code, or `0` for errors that did not come from
 * an HTTP response (job failures, poll timeouts).
 */
export class SpidraError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(status: number, message: string, options: SpidraErrorOptions = {}) {
    super(message);
    this.name = "SpidraError";
    this.status = status;
    this.code = options.code;
    this.details = options.details;
  }
}

/** Thrown when the API key is missing or invalid (HTTP 401). */
export class SpidraAuthenticationError extends SpidraError {
  constructor(message: string, options?: SpidraErrorOptions) {
    super(401, message, options);
    this.name = "SpidraAuthenticationError";
  }
}

/** Thrown when the subscription payment is overdue (HTTP 402, code `PAYMENT_OVERDUE`). */
export class SpidraPaymentRequiredError extends SpidraError {
  constructor(message: string, options?: SpidraErrorOptions) {
    super(402, message, options);
    this.name = "SpidraPaymentRequiredError";
  }
}

/** Thrown when the account has run out of credits or the key is not permitted (HTTP 403). */
export class SpidraInsufficientCreditsError extends SpidraError {
  constructor(message: string, options?: SpidraErrorOptions) {
    super(403, message, options);
    this.name = "SpidraInsufficientCreditsError";
  }
}

/** Thrown when the requested resource (job, batch, log) does not exist (HTTP 404). */
export class SpidraNotFoundError extends SpidraError {
  constructor(message: string, options?: SpidraErrorOptions) {
    super(404, message, options);
    this.name = "SpidraNotFoundError";
  }
}

/** Thrown when the request body fails validation (HTTP 422). `errors` lists each problem. */
export class SpidraValidationError extends SpidraError {
  readonly errors: string[];

  constructor(message: string, errors: string[] = [], options?: SpidraErrorOptions) {
    super(422, message, options);
    this.name = "SpidraValidationError";
    this.errors = errors;
  }
}

/** Rate-limit metadata parsed from response headers (draft-6/7/8 `RateLimit-*` and legacy `X-RateLimit-*`). */
export interface RateLimitInfo {
  /** Total requests allowed in the current window. */
  limit?: number;
  /** Requests remaining in the current window. */
  remaining?: number;
  /** When the current window resets. */
  resetAt?: Date;
  /** Suggested wait before retrying, in milliseconds (from `Retry-After` or the reset time). */
  retryAfterMs?: number;
}

/**
 * Thrown when the rate limit is exceeded or too many jobs are pending (HTTP 429).
 * Carries whatever rate-limit metadata the response headers exposed.
 */
export class SpidraRateLimitError extends SpidraError {
  readonly limit?: number;
  readonly remaining?: number;
  readonly resetAt?: Date;
  readonly retryAfterMs?: number;

  constructor(message: string, rateLimit: RateLimitInfo = {}, options?: SpidraErrorOptions) {
    super(429, message, options);
    this.name = "SpidraRateLimitError";
    this.limit = rateLimit.limit;
    this.remaining = rateLimit.remaining;
    this.resetAt = rateLimit.resetAt;
    this.retryAfterMs = rateLimit.retryAfterMs;
  }
}

/** Thrown on a server-side error (HTTP 5xx). `status` holds the exact status code. */
export class SpidraServerError extends SpidraError {
  constructor(message: string, status = 500, options?: SpidraErrorOptions) {
    super(status, message, options);
    this.name = "SpidraServerError";
  }
}

/**
 * Thrown by `.run()` waiters when the job itself finishes as `failed` or
 * `cancelled` (as opposed to a transport error talking to the API).
 */
export class SpidraJobError extends SpidraError {
  readonly jobId: string;
  readonly jobStatus: "failed" | "cancelled";

  constructor(message: string, jobId: string, jobStatus: "failed" | "cancelled") {
    super(0, message);
    this.name = "SpidraJobError";
    this.jobId = jobId;
    this.jobStatus = jobStatus;
  }
}

/**
 * Thrown when a poll/watch exceeds its `timeout`. The job keeps running
 * server-side — poll again with `.get()` or cancel it explicitly.
 */
export class SpidraTimeoutError extends SpidraError {
  readonly timeoutMs: number;
  readonly jobId?: string;

  constructor(timeoutMs: number, jobId?: string) {
    super(
      0,
      `Spidra job${jobId ? ` ${jobId}` : ""} did not finish within ${timeoutMs}ms. ` +
        "The job is still running server-side; check it again with .get() or cancel it.",
    );
    this.name = "SpidraTimeoutError";
    this.timeoutMs = timeoutMs;
    this.jobId = jobId;
  }
}

/**
 * Whether an error is worth retrying/polling through: server-side 5xx,
 * rate limits, and network-level failures. Client errors (4xx) are not.
 */
export function isRetryableError(err: unknown): boolean {
  if (err instanceof SpidraTimeoutError || err instanceof SpidraJobError) return false;
  if (err instanceof SpidraError) return err.status >= 500 || err.status === 429;
  // fetch rejects with a TypeError on network failures in Node and browsers
  if (err instanceof TypeError) return true;
  return false;
}
