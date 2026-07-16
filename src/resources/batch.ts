import type { HttpClient } from "../lib/http.js";
import { poll, type PollOptions } from "../lib/poll.js";
import { resolveSchemaParam, type InferSchemaOutput, type SchemaInput } from "../lib/schema.js";
import { BatchWatcher, type WatchOptions } from "../lib/watcher.js";
import type {
  BatchScrapeParams,
  BatchScrapeQueued,
  BatchScrapeResponse,
  BatchCancelResponse,
  BatchListParams,
  BatchListResponse,
} from "../types/batch.js";

export class BatchResource {
  constructor(private http: HttpClient) {}

  /** List all batch jobs for the authenticated user, newest first. */
  list(params: BatchListParams = {}): Promise<BatchListResponse> {
    const query = new URLSearchParams();
    if (params.page != null) query.set("page", String(params.page));
    if (params.limit != null) query.set("limit", String(params.limit));
    const qs = query.toString();
    return this.http.get<BatchListResponse>(`/batch/scrape${qs ? `?${qs}` : ""}`);
  }

  /** Submit a batch of URLs to scrape. Returns a batchId immediately. */
  async submit(params: BatchScrapeParams): Promise<BatchScrapeQueued> {
    return this.http.post<BatchScrapeQueued>("/batch/scrape", await resolveSchemaParam(params));
  }

  /** Get the current status of a batch job. */
  get<T = unknown>(batchId: string): Promise<BatchScrapeResponse<T>> {
    return this.http.get<BatchScrapeResponse<T>>(`/batch/scrape/${batchId}`);
  }

  /** Retry failed items in a batch. */
  retry(batchId: string): Promise<{ retriedCount: number }> {
    return this.http.post<{ retriedCount: number }>(
      `/batch/scrape/${batchId}/retry`,
      {}
    );
  }

  /** Cancel a pending or active batch. Credits for unprocessed items are refunded. */
  cancel(batchId: string): Promise<BatchCancelResponse> {
    return this.http.delete<BatchCancelResponse>(`/batch/scrape/${batchId}`);
  }

  /**
   * Submit a batch and wait for it to complete. The returned response may
   * still contain failed items — check `failedCount` / per-item `status`.
   */
  async run<S extends SchemaInput = Record<string, unknown>>(
    params: BatchScrapeParams<S>,
    options?: PollOptions
  ): Promise<BatchScrapeResponse<InferSchemaOutput<S>>> {
    const { batchId } = await this.submit(params);
    return poll(() => this.get<InferSchemaOutput<S>>(batchId), options, batchId);
  }

  /**
   * Watch a batch job, receiving each item as it finishes:
   *
   * ```ts
   * const watcher = client.batch.watch(batchId);
   * watcher.on("item", (item) => console.log(item.url, item.status));
   * const final = await watcher.wait();
   * ```
   */
  watch<T = unknown>(batchId: string, options?: WatchOptions): BatchWatcher<T> {
    return new BatchWatcher<T>(this, batchId, options);
  }
}
