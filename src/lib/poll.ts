import { isRetryableError, SpidraRateLimitError, SpidraTimeoutError } from "./errors.js";

export interface PollOptions {
  /** How often to check for a result, in ms. Default: 3000 */
  pollInterval?: number;
  /**
   * Max time to wait before throwing `SpidraTimeoutError`, in ms.
   * Default: `null` — wait until the job reaches a terminal state.
   * Note the job keeps running server-side after a timeout.
   */
  timeout?: number | null;
  /** Abort waiting (the job itself is not cancelled — use `.cancel()` for that). */
  signal?: AbortSignal;
  /**
   * How many consecutive transient errors (5xx, 429, network) to tolerate
   * mid-poll before giving up. Non-transient errors always throw immediately.
   * Default: 3
   */
  maxConsecutiveErrors?: number;
}

const TERMINAL_STATUSES = ["completed", "failed", "cancelled"] as const;
type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

export async function poll<T extends { status: string }>(
  fn: () => Promise<T>,
  options: PollOptions = {},
  jobId?: string
): Promise<T> {
  const { pollInterval = 3000, timeout = null, signal, maxConsecutiveErrors = 3 } = options;
  const deadline = timeout != null ? Date.now() + timeout : null;
  let consecutiveErrors = 0;

  while (true) {
    throwIfAborted(signal);

    let result: T | undefined;
    let delay = pollInterval;

    try {
      result = await fn();
      consecutiveErrors = 0;
    } catch (err) {
      consecutiveErrors++;
      if (!isRetryableError(err) || consecutiveErrors > maxConsecutiveErrors) throw err;
      // When rate-limited, wait out the window instead of hammering it
      if (err instanceof SpidraRateLimitError && err.retryAfterMs != null) {
        delay = Math.max(delay, err.retryAfterMs);
      }
    }

    if (result && TERMINAL_STATUSES.includes(result.status as TerminalStatus)) {
      return result;
    }

    if (deadline != null && Date.now() + delay > deadline) {
      throw new SpidraTimeoutError(timeout as number, jobId);
    }

    await sleep(delay, signal);
  }
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason ?? new DOMException("This operation was aborted", "AbortError");
  }
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("This operation was aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new DOMException("This operation was aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
