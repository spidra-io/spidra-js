import { TypedEmitter } from "./emitter.js";
import { isRetryableError, SpidraRateLimitError, SpidraTimeoutError } from "./errors.js";
import { sleep } from "./poll.js";
import type { CrawlJobResponse, CrawlPage, CrawlPagesResponse } from "../types/crawl.js";
import type { BatchItem, BatchScrapeResponse } from "../types/batch.js";

export interface WatchOptions {
  /** How often to poll for updates, in ms. Default: 3000 */
  pollInterval?: number;
  /**
   * Max time to watch before emitting/throwing `SpidraTimeoutError`, in ms.
   * Default: `null` — watch until the job reaches a terminal state.
   */
  timeout?: number | null;
  /** Aborting this signal stops the watcher (same as calling `.stop()`). */
  signal?: AbortSignal;
  /** Consecutive transient errors tolerated before giving up. Default: 3 */
  maxConsecutiveErrors?: number;
}

const TERMINAL_STATUSES = ["completed", "failed", "cancelled"];

interface ResolvedWatchOptions {
  pollInterval: number;
  timeout: number | null;
  maxConsecutiveErrors: number;
}

function resolveOptions(options: WatchOptions): ResolvedWatchOptions {
  return {
    pollInterval: options.pollInterval ?? 3000,
    timeout: options.timeout ?? null,
    maxConsecutiveErrors: options.maxConsecutiveErrors ?? 3,
  };
}

export interface CrawlWatcherEvents<T = unknown> extends Record<string, unknown> {
  /** Every status poll. */
  snapshot: CrawlJobResponse<T>;
  /** Each crawled page, exactly once — including pages that already existed when watching started. */
  page: CrawlPage<T>;
  /** The job reached a terminal state (completed, failed, or cancelled). */
  done: CrawlJobResponse<T>;
  /** A non-recoverable error or timeout occurred. */
  error: unknown;
}

interface CrawlWatchSource<T> {
  get(jobId: string): Promise<CrawlJobResponse<T>>;
  pages(jobId: string): Promise<CrawlPagesResponse<T>>;
}

/**
 * Push-style progress for a crawl job: polls the job status and emits each
 * new page as it lands, so callers can react per-page instead of waiting for
 * the whole crawl. Pages are only re-fetched when the crawled-page count
 * changes, keeping polling cheap between updates.
 */
export class CrawlWatcher<T = unknown> extends TypedEmitter<CrawlWatcherEvents<T>> {
  private readonly controller = new AbortController();
  private stopped = false;
  private readonly seenPages = new Set<string>();
  private readonly result: Promise<CrawlJobResponse<T> | null>;

  constructor(
    private readonly source: CrawlWatchSource<T>,
    private readonly jobId: string,
    options: WatchOptions = {}
  ) {
    super();
    if (options.signal?.aborted) this.controller.abort(options.signal.reason);
    options.signal?.addEventListener("abort", () => this.controller.abort(options.signal?.reason), { once: true });
    this.result = this.loop(resolveOptions(options));
    // rejections are also surfaced via the "error" event; don't require wait() callers
    this.result.catch(() => {});
  }

  /**
   * Resolves with the terminal job response, or `null` if the watcher was
   * stopped/aborted first. Rejects on non-recoverable errors and timeouts.
   */
  wait(): Promise<CrawlJobResponse<T> | null> {
    return this.result;
  }

  /** Stop watching. The job itself keeps running — use `crawl.cancel()` to stop it. */
  stop(): void {
    this.stopped = true;
    this.controller.abort();
  }

  private async loop(options: ResolvedWatchOptions): Promise<CrawlJobResponse<T> | null> {
    const { pollInterval, timeout, maxConsecutiveErrors } = options;
    const signal = this.controller.signal;
    const deadline = timeout != null ? Date.now() + timeout : null;
    let lastMessage: string | undefined;
    let firstPoll = true;
    let consecutiveErrors = 0;

    while (true) {
      if (signal.aborted) return null;

      let snapshot: CrawlJobResponse<T> | undefined;
      let newPages: CrawlPage<T>[] = [];
      let terminal = false;
      let delay = pollInterval;

      try {
        snapshot = await this.source.get(this.jobId);
        terminal = TERMINAL_STATUSES.includes(snapshot.status);
        // The backend's numeric `progress` only ever takes 3 values (0 -> 0.5 -> 1) and
        // isn't a per-page counter, but `message` changes with each page scraped
        // (e.g. "Scraping (3/5) https://...") -- that's the real "did something change" signal.
        const message = "progress" in snapshot && snapshot.progress ? snapshot.progress.message : undefined;
        if (firstPoll || terminal || message !== lastMessage) {
          newPages = await this.collectNewPages();
          lastMessage = message;
          firstPoll = false;
        }
        consecutiveErrors = 0;
      } catch (err) {
        if (this.stopped || signal.aborted) return null;
        consecutiveErrors++;
        if (!isRetryableError(err) || consecutiveErrors > maxConsecutiveErrors) {
          this.emit("error", err);
          throw err;
        }
        if (err instanceof SpidraRateLimitError && err.retryAfterMs != null) {
          delay = Math.max(delay, err.retryAfterMs);
        }
        snapshot = undefined;
      }

      if (snapshot) {
        this.emit("snapshot", snapshot);
        for (const page of newPages) this.emit("page", page);
        if (terminal) {
          this.emit("done", snapshot);
          return snapshot;
        }
      }

      if (deadline != null && Date.now() + delay > deadline) {
        const err = new SpidraTimeoutError(timeout as number, this.jobId);
        this.emit("error", err);
        throw err;
      }

      try {
        await sleep(delay, signal);
      } catch {
        return null; // stopped/aborted while sleeping
      }
    }
  }

  private async collectNewPages(): Promise<CrawlPage<T>[]> {
    const { pages } = await this.source.pages(this.jobId);
    const fresh: CrawlPage<T>[] = [];
    for (const page of pages) {
      const key = page.id ?? page.url;
      if (this.seenPages.has(key)) continue;
      this.seenPages.add(key);
      fresh.push(page);
    }
    return fresh;
  }
}

export interface BatchWatcherEvents<T = unknown> extends Record<string, unknown> {
  /** Every status poll. */
  snapshot: BatchScrapeResponse<T>;
  /** Each item that finished (completed or failed), exactly once. */
  item: BatchItem<T>;
  /** The batch reached a terminal state (completed, failed, or cancelled). */
  done: BatchScrapeResponse<T>;
  /** A non-recoverable error or timeout occurred. */
  error: unknown;
}

interface BatchWatchSource<T> {
  get(batchId: string): Promise<BatchScrapeResponse<T>>;
}

/**
 * Push-style progress for a batch job: emits each item as it finishes
 * (completed or failed), so callers can process results as they arrive.
 */
export class BatchWatcher<T = unknown> extends TypedEmitter<BatchWatcherEvents<T>> {
  private readonly controller = new AbortController();
  private stopped = false;
  private readonly seenItems = new Set<string>();
  private readonly result: Promise<BatchScrapeResponse<T> | null>;

  constructor(
    private readonly source: BatchWatchSource<T>,
    private readonly batchId: string,
    options: WatchOptions = {}
  ) {
    super();
    if (options.signal?.aborted) this.controller.abort(options.signal.reason);
    options.signal?.addEventListener("abort", () => this.controller.abort(options.signal?.reason), { once: true });
    this.result = this.loop(resolveOptions(options));
    this.result.catch(() => {});
  }

  /**
   * Resolves with the terminal batch response, or `null` if the watcher was
   * stopped/aborted first. Rejects on non-recoverable errors and timeouts.
   */
  wait(): Promise<BatchScrapeResponse<T> | null> {
    return this.result;
  }

  /** Stop watching. The batch itself keeps running — use `batch.cancel()` to stop it. */
  stop(): void {
    this.stopped = true;
    this.controller.abort();
  }

  private async loop(options: ResolvedWatchOptions): Promise<BatchScrapeResponse<T> | null> {
    const { pollInterval, timeout, maxConsecutiveErrors } = options;
    const signal = this.controller.signal;
    const deadline = timeout != null ? Date.now() + timeout : null;
    let consecutiveErrors = 0;

    while (true) {
      if (signal.aborted) return null;

      let snapshot: BatchScrapeResponse<T> | undefined;
      let delay = pollInterval;

      try {
        snapshot = await this.source.get(this.batchId);
        consecutiveErrors = 0;
      } catch (err) {
        if (this.stopped || signal.aborted) return null;
        consecutiveErrors++;
        if (!isRetryableError(err) || consecutiveErrors > maxConsecutiveErrors) {
          this.emit("error", err);
          throw err;
        }
        if (err instanceof SpidraRateLimitError && err.retryAfterMs != null) {
          delay = Math.max(delay, err.retryAfterMs);
        }
      }

      if (snapshot) {
        this.emit("snapshot", snapshot);
        for (const item of snapshot.items) {
          if (item.status !== "completed" && item.status !== "failed") continue;
          if (this.seenItems.has(item.uuid)) continue;
          this.seenItems.add(item.uuid);
          this.emit("item", item);
        }
        if (TERMINAL_STATUSES.includes(snapshot.status)) {
          this.emit("done", snapshot);
          return snapshot;
        }
      }

      if (deadline != null && Date.now() + delay > deadline) {
        const err = new SpidraTimeoutError(timeout as number, this.batchId);
        this.emit("error", err);
        throw err;
      }

      try {
        await sleep(delay, signal);
      } catch {
        return null; // stopped/aborted while sleeping
      }
    }
  }
}
