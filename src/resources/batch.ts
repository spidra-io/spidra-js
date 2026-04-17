import type { HttpClient } from "../lib/http.js";
import { poll, type PollOptions } from "../lib/poll.js";
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
  submit(params: BatchScrapeParams): Promise<BatchScrapeQueued> {
    return this.http.post<BatchScrapeQueued>("/batch/scrape", params);
  }

  /** Get the current status of a batch job. */
  get(batchId: string): Promise<BatchScrapeResponse> {
    return this.http.get<BatchScrapeResponse>(`/batch/scrape/${batchId}`);
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

  /** Submit a batch and wait for it to complete. */
  async run(
    params: BatchScrapeParams,
    options?: PollOptions
  ): Promise<BatchScrapeResponse> {
    const { batchId } = await this.submit(params);
    return poll(() => this.get(batchId), options);
  }
}
