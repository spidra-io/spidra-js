import type { HttpClient } from "../lib/http.js";
import { poll, type PollOptions } from "../lib/poll.js";
import { SpidraJobError } from "../lib/errors.js";
import { resolveSchemaParam, type InferSchemaOutput, type SchemaInput } from "../lib/schema.js";
import { CrawlWatcher, type WatchOptions } from "../lib/watcher.js";
import type {
  CrawlParams,
  CrawlQueued,
  CrawlJobResponse,
  CrawlJobCompleted,
  CrawlPagesResponse,
  CrawlHistoryParams,
  CrawlHistoryResponse,
  CrawlStats,
  CrawlCancelResponse,
} from "../types/crawl.js";

export class CrawlResource {
  constructor(private http: HttpClient) {}

  /** List past crawl jobs for the authenticated user, newest first. */
  history(params: CrawlHistoryParams = {}): Promise<CrawlHistoryResponse> {
    const query = new URLSearchParams();
    if (params.page != null) query.set("page", String(params.page));
    if (params.limit != null) query.set("limit", String(params.limit));
    const qs = query.toString();
    return this.http.get<CrawlHistoryResponse>(`/crawl/history${qs ? `?${qs}` : ""}`);
  }

  /** Get total crawl job count for the authenticated user. */
  stats(): Promise<CrawlStats> {
    return this.http.get<CrawlStats>("/crawl/stats");
  }

  /** Submit a crawl job. Returns a jobId immediately. */
  async submit(params: CrawlParams): Promise<CrawlQueued> {
    return this.http.post<CrawlQueued>("/crawl", await resolveSchemaParam(params));
  }

  /** Get the current status of a crawl job. */
  get<T = unknown>(jobId: string): Promise<CrawlJobResponse<T>> {
    return this.http.get<CrawlJobResponse<T>>(`/crawl/${jobId}`);
  }

  /** Get crawled pages with signed download URLs. */
  pages<T = unknown>(jobId: string): Promise<CrawlPagesResponse<T>> {
    return this.http.get<CrawlPagesResponse<T>>(`/crawl/${jobId}/pages`);
  }

  /** Re-extract data from an existing crawl with a new transform instruction (no re-crawling). */
  extract(jobId: string, transformInstruction: string): Promise<CrawlQueued> {
    return this.http.post<CrawlQueued>(`/crawl/${jobId}/extract`, {
      transformInstruction,
    });
  }

  /** Cancel a queued or running crawl job. Pages already processed are preserved. */
  cancel(jobId: string): Promise<CrawlCancelResponse> {
    return this.http.delete<CrawlCancelResponse>(`/crawl/${jobId}`);
  }

  /**
   * Submit a crawl job and wait for it to complete.
   * Throws `SpidraJobError` if the job fails or is cancelled, and
   * `SpidraTimeoutError` if `options.timeout` is set and exceeded.
   */
  async run<S extends SchemaInput = Record<string, unknown>>(
    params: CrawlParams<S>,
    options?: PollOptions
  ): Promise<CrawlJobCompleted<InferSchemaOutput<S>>> {
    const { jobId } = await this.submit(params);

    const result = await poll(() => this.get<InferSchemaOutput<S>>(jobId), options, jobId);

    if (result.status === "failed") {
      throw new SpidraJobError(result.error ?? "Crawl job failed", jobId, "failed");
    }

    if (result.status === "cancelled") {
      throw new SpidraJobError("Crawl job was cancelled", jobId, "cancelled");
    }

    return result as CrawlJobCompleted<InferSchemaOutput<S>>;
  }

  /**
   * Watch a crawl job, receiving each page as it is crawled:
   *
   * ```ts
   * const watcher = client.crawl.watch(jobId);
   * watcher.on("page", (page) => console.log(page.url, page.data));
   * const final = await watcher.wait();
   * ```
   */
  watch<T = unknown>(jobId: string, options?: WatchOptions): CrawlWatcher<T> {
    return new CrawlWatcher<T>(this, jobId, options);
  }
}
