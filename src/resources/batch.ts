import type { HttpClient } from "../lib/http.js";
import { poll, type PollOptions } from "../lib/poll.js";
import type {
  BatchScrapeParams,
  BatchScrapeQueued,
  BatchScrapeResponse,
} from "../types/batch.js";

export class BatchResource {
  constructor(private http: HttpClient) {}

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

  /** Cancel a pending or active batch. */
  cancel(batchId: string): Promise<void> {
    return this.http.delete<void>(`/batch/scrape/${batchId}`);
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
