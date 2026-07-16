export interface SpidraConfig {
  apiKey: string;
  /** Override the base URL. Defaults to https://api.spidra.io/api */
  baseUrl?: string;
  /** Bring your own fetch implementation */
  fetch?: typeof fetch;
  /**
   * How many times to retry a request that failed transiently (network error,
   * 502/503/504). Client errors (4xx) are never retried, and POSTs are only
   * retried when the server signalled the request was not accepted.
   * Default: 3. Set to 0 to disable retries.
   */
  maxRetries?: number;
  /**
   * Base delay in milliseconds for exponential backoff between retries —
   * the delay is `backoffFactor * 2^attempt`. Default: 500.
   */
  backoffFactor?: number;
}
